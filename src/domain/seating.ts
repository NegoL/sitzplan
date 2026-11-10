import { parseSeat, seatKey, type Assignment, type Level, type Room, type Rule, type SeatKey, type Student } from './types'

export type Violation = { ruleId: string; level: Level; students: string[] }

export type GenerateInput = {
  room: Room
  students: Student[]
  rules: Rule[]
  /** Seats nobody may use. */
  blocked: SeatKey[]
  /** Students that stay on the given seat. */
  pinned: Record<string, SeatKey>
  /** The plan to rotate away from: new neighbours first, new places second. */
  previous?: Assignment
  /** A different seed gives a different plan. */
  seed: number
}

export type GenerateResult = {
  assignment: Assignment
  /** Rules the plan breaks, one entry per offending group of students. */
  violations: Violation[]
  /** Ids of must rules that cannot all hold at once. Empty when they can. */
  conflict: string[]
  /** How many students have none of their previous neighbours. Null without a previous plan. */
  rotation: NeighbourChange | null
}

/** Of the `total` students seated in both plans, `newNeighbours` sit beside none of their earlier neighbours. */
export type NeighbourChange = { newNeighbours: number; total: number }

const MUST = 1e7
const NICE = 1e4
const LONELY = 300
const ROW = 50
const SINGLE_NEEDS_NEIGHBOUR_SEAT = 40
const SAME_NEIGHBOUR = 20
const SAME_SEAT = 6

/** The room and class turned into index arrays, so the search loop stays cheap. */
type Model = {
  seatKeys: SeatKey[]
  row: number[]
  /** 0 for the frontmost row that has seats, 1 for the next one, … */
  rowRank: number[]
  col: number[]
  left: number[]
  right: number[]
  usable: boolean[]
  ids: string[]
  rules: IndexedRule[]
  wantsSingle: boolean[]
}

type IndexedRule = { rule: Rule; student: number; others: number[]; seat: number }

type Seating = { pos: number[]; occ: number[] }

function buildModel(room: Room, students: Student[], rules: Rule[], blocked: SeatKey[]): Model {
  const seatKeys = [...room.seats]
  const index = new Map(seatKeys.map((k, i) => [k, i]))
  const coords = seatKeys.map(parseSeat)
  const at = (row: number, col: number) => index.get(seatKey({ row, col })) ?? -1
  const blockedSet = new Set(blocked)
  const seatRows = [...new Set(coords.map((c) => c.row))].sort((a, b) => a - b)
  const ids = students.map((s) => s.id)
  const studentIndex = new Map(ids.map((id, i) => [id, i]))
  const indexed: IndexedRule[] = []
  const wantsSingle = ids.map(() => false)
  for (const rule of rules) {
    const student = studentIndex.get(rule.student)
    if (student === undefined) continue
    const others = 'others' in rule ? rule.others.map((o) => studentIndex.get(o) ?? -1).filter((o) => o >= 0 && o !== student) : []
    const seat = rule.kind === 'fixed' ? (index.get(rule.seat) ?? -1) : -1
    if (rule.kind === 'single') wantsSingle[student] = true
    indexed.push({ rule, student, others, seat })
  }
  return {
    seatKeys,
    row: coords.map((c) => c.row),
    rowRank: coords.map((c) => seatRows.indexOf(c.row)),
    col: coords.map((c) => c.col),
    left: coords.map((c) => at(c.row, c.col - 1)),
    right: coords.map((c) => at(c.row, c.col + 1)),
    usable: seatKeys.map((k) => !blockedSet.has(k)),
    ids,
    rules: indexed,
    wantsSingle,
  }
}

function seatingFrom(m: Model, assignment: Assignment): Seating {
  const index = new Map(m.seatKeys.map((k, i) => [k, i]))
  const pos = m.ids.map(() => -1)
  const occ = m.seatKeys.map(() => -1)
  m.ids.forEach((id, s) => {
    const seat = index.get(assignment[id]) ?? -1
    if (seat >= 0 && occ[seat] < 0) {
      pos[s] = seat
      occ[seat] = s
    }
  })
  return { pos, occ }
}

/**
 * How badly a seating breaks one rule: 0 when it holds. With `out`, also
 * collects each offending group of student indices.
 */
function broken(m: Model, r: IndexedRule, { pos, occ }: Seating, out?: number[][]): number {
  const p = pos[r.student]
  if (p < 0) return 0
  const besideSeat = (q: number) => m.left[p] === q || m.right[p] === q
  const rule = r.rule
  let units = 0
  switch (rule.kind) {
    case 'beside': {
      const seated = r.others.filter((o) => pos[o] >= 0)
      if (rule.any) {
        if (seated.length && !seated.some((o) => besideSeat(pos[o]))) {
          units = 1
          out?.push([r.student, ...seated])
        }
      } else {
        for (const o of seated) {
          if (!besideSeat(pos[o])) {
            units++
            out?.push([r.student, o])
          }
        }
      }
      break
    }
    case 'apart':
      for (const o of r.others) {
        const q = pos[o]
        if (q < 0) continue
        const tooClose = rule.near
          ? Math.abs(m.row[p] - m.row[q]) <= 1 && Math.abs(m.col[p] - m.col[q]) <= 1
          : besideSeat(q)
        if (tooClose) {
          units++
          out?.push([r.student, o])
        }
      }
      break
    case 'front':
      if (m.rowRank[p] >= rule.rows) {
        units = m.rowRank[p] - rule.rows + 1
        out?.push([r.student])
      }
      break
    case 'fixed':
      if (p !== r.seat) {
        units = 1
        out?.push([r.student])
      }
      break
    case 'single': {
      const neighbours = [m.left[p], m.right[p]].filter((q) => q >= 0 && occ[q] >= 0).map((q) => occ[q])
      if (neighbours.length) {
        units = neighbours.length
        out?.push([r.student, ...neighbours])
      }
      break
    }
  }
  return units
}

function violations(m: Model, seating: Seating): Violation[] {
  const result: Violation[] = []
  for (const r of m.rules) {
    const groups: number[][] = []
    broken(m, r, seating, groups)
    for (const g of groups) result.push({ ruleId: r.rule.id, level: r.rule.level, students: g.map((s) => m.ids[s]) })
  }
  return result
}

/** Which rules a given seating breaks. Rules about unseated or unknown students are skipped. */
export function check(room: Room, students: Student[], rules: Rule[], assignment: Assignment): Violation[] {
  const m = buildModel(room, students, rules, [])
  return violations(m, seatingFrom(m, assignment))
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Previous = { seat: number[]; pairs: Set<number> }

function previousOf(m: Model, assignment: Assignment): Previous {
  const { pos, occ } = seatingFrom(m, assignment)
  const pairs = new Set<number>()
  const n = m.ids.length
  occ.forEach((s, seat) => {
    const r = m.right[seat]
    if (s >= 0 && r >= 0 && occ[r] >= 0) {
      pairs.add(s * n + occ[r])
      pairs.add(occ[r] * n + s)
    }
  })
  return { seat: pos, pairs }
}

function neighbourChange(m: Model, prev: Previous, { pos, occ }: Seating): NeighbourChange {
  const n = m.ids.length
  let total = 0
  let newNeighbours = 0
  pos.forEach((p, s) => {
    if (p < 0 || prev.seat[s] < 0) return
    total++
    const now = [m.left[p], m.right[p]].filter((q) => q >= 0 && occ[q] >= 0).map((q) => occ[q])
    if (!now.some((o) => prev.pairs.has(s * n + o))) newNeighbours++
  })
  return { newNeighbours, total }
}

/** How far a seating has rotated away from an earlier one in the same room. */
export function rotation(room: Room, students: Student[], previous: Assignment, current: Assignment): NeighbourChange {
  const m = buildModel(room, students, [], [])
  return neighbourChange(m, previousOf(m, previous), seatingFrom(m, current))
}

/** Everything that is not a rule: free seats at the back, nobody alone, and rotating. */
function preferences(m: Model, { pos, occ }: Seating, prev: Previous | null): number {
  const n = m.ids.length
  let cost = 0
  for (let s = 0; s < n; s++) {
    const p = pos[s]
    if (p < 0) continue
    cost += ROW * m.row[p]
    const l = m.left[p]
    const r = m.right[p]
    const leftOcc = l >= 0 ? occ[l] : -1
    const rightOcc = r >= 0 ? occ[r] : -1
    if (m.wantsSingle[s]) {
      if (l >= 0 && m.usable[l]) cost += SINGLE_NEEDS_NEIGHBOUR_SEAT
      if (r >= 0 && m.usable[r]) cost += SINGLE_NEEDS_NEIGHBOUR_SEAT
    } else if (leftOcc < 0 && rightOcc < 0) {
      cost += LONELY
    }
    if (prev) {
      if (rightOcc >= 0 && prev.pairs.has(s * n + rightOcc)) cost += SAME_NEIGHBOUR
      const q = prev.seat[s]
      if (q >= 0) {
        if (q === p) cost += SAME_SEAT
        cost += 2 * Math.max(0, 2 - Math.abs(m.row[p] - m.row[q])) + Math.max(0, 2 - Math.abs(m.col[p] - m.col[q]))
      }
    }
  }
  return cost
}

type Search = { m: Model; movable: number[]; pinnedSeat: number[]; rng: () => number }

/** Pinned students on their seats, everyone else on a random free one. */
function randomSeating({ m, pinnedSeat, rng }: Search): Seating {
  const pos = m.ids.map(() => -1)
  const occ = m.seatKeys.map(() => -1)
  pinnedSeat.forEach((seat, s) => {
    if (seat >= 0) {
      pos[s] = seat
      occ[seat] = s
    }
  })
  const free = m.seatKeys.map((_, i) => i).filter((i) => m.usable[i] && occ[i] < 0)
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[free[i], free[j]] = [free[j], free[i]]
  }
  for (let s = 0; s < pos.length; s++) {
    if (pos[s] >= 0) continue
    const seat = free.pop()
    if (seat === undefined) break
    pos[s] = seat
    occ[seat] = s
  }
  return { pos, occ }
}

function swap({ pos, occ }: Seating, i: number, j: number) {
  const a = occ[i]
  const b = occ[j]
  occ[i] = b
  occ[j] = a
  if (a >= 0) pos[a] = j
  if (b >= 0) pos[b] = i
}

/** Simulated annealing over seat swaps, in place. Returns the cost reached. */
function anneal(search: Search, seating: Seating, cost: (s: Seating) => number, hot: number, cold: number, steps: number): number {
  const { movable, rng } = search
  let current = cost(seating)
  if (movable.length < 2) return current
  let best = current
  let bestPos = [...seating.pos]
  const cooling = Math.pow(cold / hot, 1 / steps)
  let t = hot
  for (let step = 0; step < steps && best > 0; step++, t *= cooling) {
    const i = movable[Math.floor(rng() * movable.length)]
    const j = movable[Math.floor(rng() * movable.length)]
    if (i === j || (seating.occ[i] < 0 && seating.occ[j] < 0)) continue
    swap(seating, i, j)
    const next = cost(seating)
    if (next <= current || rng() < Math.exp((current - next) / t)) {
      current = next
      if (current < best) {
        best = current
        bestPos = [...seating.pos]
      }
    } else {
      swap(seating, i, j)
    }
  }
  seating.occ.fill(-1)
  bestPos.forEach((p, s) => {
    seating.pos[s] = p
    if (p >= 0) seating.occ[p] = s
  })
  return best
}

/** Tries to seat everyone so that the given rules all hold. Returns the seating, or null. */
function satisfy(search: Search, rules: IndexedRule[], tries: number, steps: number): Seating | null {
  const units = (s: Seating) => {
    let u = 0
    for (const r of rules) u += broken(search.m, r, s)
    return u
  }
  for (let i = 0; i < tries; i++) {
    const seating = randomSeating(search)
    if (anneal(search, seating, units, 2, 0.05, steps) === 0) return seating
  }
  return null
}

/** Shrinks the must rules to a set that still cannot hold together but would if any one were dropped. */
function conflicting(search: Search, must: IndexedRule[]): string[] {
  let core = must
  for (const r of must) {
    const without = core.filter((x) => x !== r)
    if (!satisfy(search, without, 3, 3000)) core = without
  }
  return core.map((r) => r.rule.id)
}

/**
 * Seats a class in a room; if the room has too few seats, the last students stay unseated. Must rules come first, then wishes, then free
 * seats at the back with nobody alone, then rotating away from `previous`.
 */
export function generate(input: GenerateInput): GenerateResult {
  const m = buildModel(input.room, input.students, input.rules, input.blocked)
  const seatIndex = new Map(m.seatKeys.map((k, i) => [k, i]))
  const taken = new Set<number>()
  const pinnedSeat = m.ids.map((id) => {
    const seat = seatIndex.get(input.pinned[id]) ?? -1
    if (seat < 0 || !m.usable[seat] || taken.has(seat)) return -1
    taken.add(seat)
    return seat
  })
  const movable = m.seatKeys.map((_, i) => i).filter((i) => m.usable[i] && !taken.has(i))
  const search: Search = { m, movable, pinnedSeat, rng: mulberry32(input.seed) }
  const prev = input.previous ? previousOf(m, input.previous) : null
  const must = m.rules.filter((r) => r.rule.level === 'must')
  const total = (s: Seating) => {
    let cost = preferences(m, s, prev)
    for (const r of m.rules) {
      const u = broken(m, r, s)
      if (u) cost += u * (r.rule.level === 'must' ? MUST : NICE)
    }
    return cost
  }

  let best: Seating | null = null
  let bestCost = Infinity
  let feasible = true
  for (let run = 0; run < 6; run++) {
    // Start from a seating that keeps every must rule: the search never trades one away afterwards.
    const start = feasible ? satisfy(search, must, run === 0 ? 8 : 2, 6000) : null
    if (!start && run === 0) feasible = false
    const seating = start ?? randomSeating(search)
    const cost = anneal(search, seating, total, 3000, 1, 15000)
    if (cost < bestCost) {
      bestCost = cost
      best = seating
    }
  }
  const seating = best!
  const found = violations(m, seating)
  const assignment: Assignment = {}
  seating.pos.forEach((p, s) => {
    if (p >= 0) assignment[m.ids[s]] = m.seatKeys[p]
  })

  return {
    assignment,
    violations: found,
    conflict: found.some((v) => v.level === 'must') ? conflicting(search, must) : [],
    rotation: prev ? neighbourChange(m, prev, seating) : null,
  }
}
