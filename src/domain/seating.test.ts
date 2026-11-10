import { describe, expect, it } from 'vitest'
import { check, generate, type GenerateInput } from './seating'
import type { Assignment, Room, Rule, Student } from './types'

/** Builds a room from a drawing. Last line is the row nearest the board; '#' is a seat, '.' an aisle. */
function room(...drawing: string[]): Room {
  const lines = [...drawing].reverse()
  const seats: string[] = []
  lines.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      if (ch === '#') seats.push(`${row},${col}`)
    }),
  )
  return { id: 'r', name: 'Raum', rows: lines.length, cols: lines[0].length, seats }
}

function students(...names: string[]): Student[] {
  return names.map((n) => ({ id: n, first: n, last: 'X' }))
}

function input(over: Partial<GenerateInput> & Pick<GenerateInput, 'room' | 'students'>): GenerateInput {
  return { rules: [], blocked: [], pinned: {}, seed: 1, ...over }
}

const rowOf = (a: Assignment, s: string) => Number(a[s].split(',')[0])
const colOf = (a: Assignment, s: string) => Number(a[s].split(',')[1])
const beside = (a: Assignment, x: string, y: string) =>
  rowOf(a, x) === rowOf(a, y) && Math.abs(colOf(a, x) - colOf(a, y)) === 1

describe('generate', () => {
  it('gives every student a seat of their own', () => {
    const r = generate(input({ room: room('###', '###'), students: students('a', 'b', 'c', 'd', 'e') }))
    const used = Object.values(r.assignment)
    expect(Object.keys(r.assignment).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(new Set(used).size).toBe(5)
    for (const k of used) expect(room('###', '###').seats).toContain(k)
  })

  it('reports when the room has too few seats', () => {
    const r = generate(input({ room: room('##'), students: students('a', 'b', 'c') }))
    expect(r.tooFewSeats).toBe(true)
  })

  it('never uses a blocked seat', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('###'), students: students('a', 'b'), blocked: ['0,1'], seed }))
      expect(Object.values(r.assignment)).not.toContain('0,1')
    }
  })

  it('seats two students beside each other when a rule demands it', () => {
    const rules: Rule[] = [{ id: '1', kind: 'beside', level: 'must', student: 'a', others: ['f'] }]
    const r = generate(input({ room: room('##.##', '##.##'), students: students('a', 'b', 'c', 'd', 'e', 'f'), rules }))
    expect(beside(r.assignment, 'a', 'f')).toBe(true)
    expect(r.violations).toEqual([])
  })

  it('puts a student between two required neighbours', () => {
    const rules: Rule[] = [{ id: '1', kind: 'beside', level: 'must', student: 'a', others: ['b', 'c'] }]
    const r = generate(input({ room: room('####', '####'), students: students('a', 'b', 'c', 'd', 'e', 'f', 'g'), rules }))
    expect(beside(r.assignment, 'a', 'b')).toBe(true)
    expect(beside(r.assignment, 'a', 'c')).toBe(true)
  })

  it('needs only one of them beside when more than two are named', () => {
    const rules: Rule[] = [{ id: '1', kind: 'beside', level: 'must', student: 'a', others: ['b', 'c', 'd'] }]
    const r = generate(input({ room: room('####', '####'), students: students('a', 'b', 'c', 'd', 'e', 'f', 'g'), rules }))
    expect(['b', 'c', 'd'].some((o) => beside(r.assignment, 'a', o))).toBe(true)
    expect(r.violations).toEqual([])
  })

  it('keeps one student away from several others with a single rule', () => {
    const rules: Rule[] = [{ id: '1', kind: 'apart', level: 'must', student: 'a', others: ['b', 'c', 'd'], near: false }]
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('###', '###'), students: students('a', 'b', 'c', 'd', 'e', 'f'), rules, seed }))
      for (const o of ['b', 'c', 'd']) expect(beside(r.assignment, 'a', o)).toBe(false)
    }
  })

  it('keeps students out of each other\'s surroundings with the stricter level', () => {
    const rules: Rule[] = [{ id: '1', kind: 'apart', level: 'must', student: 'a', others: ['b'], near: true }]
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('###', '###', '###'), students: students('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'), rules, seed }))
      const far = Math.abs(rowOf(r.assignment, 'a') - rowOf(r.assignment, 'b')) > 1 || Math.abs(colOf(r.assignment, 'a') - colOf(r.assignment, 'b')) > 1
      expect(far).toBe(true)
    }
  })

  it('seats a student within the first rows', () => {
    const rules: Rule[] = [
      { id: '1', kind: 'front', level: 'must', student: 'a', rows: 1 },
      { id: '2', kind: 'front', level: 'must', student: 'b', rows: 2 },
    ]
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('##', '##', '##', '##'), students: students('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), rules, seed }))
      expect(rowOf(r.assignment, 'a')).toBe(0)
      expect(rowOf(r.assignment, 'b')).toBeLessThan(2)
    }
  })

  it('seats a student on a fixed seat', () => {
    const rules: Rule[] = [{ id: '1', kind: 'fixed', level: 'must', student: 'a', seat: '1,2', roomId: 'r' }]
    const r = generate(input({ room: room('###', '###'), students: students('a', 'b', 'c', 'd', 'e'), rules }))
    expect(r.assignment.a).toBe('1,2')
  })

  it('leaves the seats left and right of a single-seat student empty', () => {
    const rules: Rule[] = [{ id: '1', kind: 'single', level: 'must', student: 'a' }]
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('####', '####'), students: students('a', 'b', 'c', 'd', 'e', 'f'), rules, seed }))
      const others = ['b', 'c', 'd', 'e', 'f']
      expect(others.some((o) => beside(r.assignment, 'a', o))).toBe(false)
      expect(r.violations).toEqual([])
    }
  })

  it('prefers a stand-alone desk for a single-seat student', () => {
    const rules: Rule[] = [{ id: '1', kind: 'single', level: 'must', student: 'a' }]
    const r = generate(input({ room: room('##.#', '##.#'), students: students('a', 'b', 'c', 'd'), rules }))
    expect(colOf(r.assignment, 'a')).toBe(3)
  })

  it('breaks a wish rather than a must rule', () => {
    const rules: Rule[] = [
      { id: 'wish', kind: 'beside', level: 'nice', student: 'a', others: ['b'] },
      { id: 'must', kind: 'apart', level: 'must', student: 'a', others: ['b'], near: false },
    ]
    const r = generate(input({ room: room('##', '##'), students: students('a', 'b', 'c', 'd'), rules }))
    expect(beside(r.assignment, 'a', 'b')).toBe(false)
    expect(r.violations.map((v) => v.ruleId)).toEqual(['wish'])
    expect(r.conflict).toEqual([])
  })

  it('names the must rules that contradict each other', () => {
    const rules: Rule[] = [
      { id: 'ok', kind: 'front', level: 'must', student: 'c', rows: 1 },
      { id: 'together', kind: 'beside', level: 'must', student: 'a', others: ['b'] },
      { id: 'apart', kind: 'apart', level: 'must', student: 'b', others: ['a'], near: false },
    ]
    const r = generate(input({ room: room('##', '##'), students: students('a', 'b', 'c', 'd'), rules }))
    expect([...r.conflict].sort()).toEqual(['apart', 'together'])
  })

  it('leaves the back seats free and nobody sitting alone', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('####', '####', '####'), students: students('a', 'b', 'c', 'd', 'e', 'f'), seed }))
      const rows = Object.keys(r.assignment).map((s) => rowOf(r.assignment, s))
      expect(Math.max(...rows)).toBe(1)
      for (const s of Object.keys(r.assignment)) {
        expect(Object.keys(r.assignment).some((o) => o !== s && beside(r.assignment, s, o))).toBe(true)
      }
    }
  })

  it('leaves pinned students where they are', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const r = generate(input({ room: room('###', '###'), students: students('a', 'b', 'c', 'd', 'e', 'f'), pinned: { a: '1,1', b: '0,2' }, seed }))
      expect(r.assignment.a).toBe('1,1')
      expect(r.assignment.b).toBe('0,2')
    }
  })

  it('produces a different plan for a different seed', () => {
    const base = { room: room('####', '####', '####'), students: students('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l') }
    const one = generate(input({ ...base, seed: 1 }))
    const two = generate(input({ ...base, seed: 2 }))
    expect(one.assignment).not.toEqual(two.assignment)
  })

  it('gives students new neighbours and new places compared with the previous plan', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
    const rm = room('##.##', '##.##', '##.##')
    const previous: Assignment = {}
    names.forEach((n, i) => (previous[n] = rm.seats[i]))
    const r = generate(input({ room: rm, students: students(...names), previous }))
    const oldPairs = [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j'], ['k', 'l']]
    for (const [x, y] of oldPairs) expect(beside(r.assignment, x, y)).toBe(false)
    expect(names.filter((n) => r.assignment[n] === previous[n])).toEqual([])
    expect(r.rotation).toEqual({ newNeighbours: 12, total: 12 })
  })

  it('keeps rules ahead of rotating', () => {
    const names = ['a', 'b', 'c', 'd']
    const rm = room('##', '##')
    const previous: Assignment = { a: '0,0', b: '0,1', c: '1,0', d: '1,1' }
    const rules: Rule[] = [{ id: '1', kind: 'beside', level: 'nice', student: 'a', others: ['b'] }]
    const r = generate(input({ room: rm, students: students(...names), rules, previous }))
    expect(beside(r.assignment, 'a', 'b')).toBe(true)
    expect(r.rotation).toEqual({ newNeighbours: 0, total: 4 })
  })
})

describe('check', () => {
  const rm = room('##.##')
  const all = students('a', 'b', 'c', 'd')
  const seated: Assignment = { a: '0,0', b: '0,1', c: '0,3', d: '0,4' }

  it('does not count students across an aisle as beside each other', () => {
    const rules: Rule[] = [{ id: '1', kind: 'beside', level: 'must', student: 'b', others: ['c'] }]
    expect(check(rm, all, rules, seated)).toEqual([{ ruleId: '1', level: 'must', students: ['b', 'c'] }])
  })

  it('marks only the pair that breaks a rule naming several students', () => {
    const rules: Rule[] = [{ id: '1', kind: 'apart', level: 'nice', student: 'a', others: ['b', 'c', 'd'], near: false }]
    expect(check(rm, all, rules, seated)).toEqual([{ ruleId: '1', level: 'nice', students: ['a', 'b'] }])
  })

  it('lets the others of an apart rule sit beside each other', () => {
    const rules: Rule[] = [{ id: '1', kind: 'apart', level: 'must', student: 'a', others: ['c', 'd'], near: false }]
    expect(check(rm, all, rules, seated)).toEqual([])
  })

  it('reports a single-seat student with a neighbour', () => {
    const rules: Rule[] = [{ id: '1', kind: 'single', level: 'must', student: 'a' }]
    expect(check(rm, all, rules, seated)).toEqual([{ ruleId: '1', level: 'must', students: ['a', 'b'] }])
  })

  it('reports a student seated too far back or off their fixed seat', () => {
    const two = room('##', '##')
    const rules: Rule[] = [
      { id: '1', kind: 'front', level: 'must', student: 'a', rows: 1 },
      { id: '2', kind: 'fixed', level: 'nice', student: 'b', seat: '0,0', roomId: 'r' },
    ]
    expect(check(two, students('a', 'b'), rules, { a: '1,0', b: '0,1' })).toEqual([
      { ruleId: '1', level: 'must', students: ['a'] },
      { ruleId: '2', level: 'nice', students: ['b'] },
    ])
  })

  it('ignores rules about students without a seat', () => {
    const rules: Rule[] = [{ id: '1', kind: 'beside', level: 'must', student: 'a', others: ['z'] }]
    expect(check(rm, all, rules, seated)).toEqual([])
  })
})
