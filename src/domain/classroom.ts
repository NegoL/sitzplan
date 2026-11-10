import { parseSeat, type AppState, type SeatKey, type Plan, type Rule, type SchoolClass, type Student } from './types'

/** The rules that apply in a given room: a fixed seat only counts in the room it was picked in. */
export function rulesFor(cls: SchoolClass, roomId: string): Rule[] {
  return cls.rules.filter((r) => r.kind !== 'fixed' || r.roomId === roomId)
}

/** The plan to rotate away from: the latest earlier plan of the same class in the same room that has children seated. */
export function previousPlan(state: AppState, plan: Plan): Plan | undefined {
  return state.plans
    .filter((p) => p.classId === plan.classId && p.roomId === plan.roomId && p.createdAt < plan.createdAt && Object.keys(p.assignment).length > 0)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

/** Short seat labels: first name, plus the surname initial (or the surname) where first names repeat. */
export function displayNames(students: Student[]): Map<string, string> {
  const count = (labels: string[]) => {
    const n = new Map<string, number>()
    for (const l of labels) n.set(l, (n.get(l) ?? 0) + 1)
    return n
  }
  const first = students.map((s) => s.first || s.last)
  const firstCount = count(first)
  const initial = students.map((s, i) => (firstCount.get(first[i])! > 1 && s.first && s.last ? `${s.first} ${s.last[0]}.` : first[i]))
  const initialCount = count(initial)
  return new Map(students.map((s, i) => [s.id, initialCount.get(initial[i])! > 1 ? `${s.first} ${s.last}`.trim() : initial[i]]))
}

/** Removes a student together with their seat in every plan and every rule about them. */
export function removeStudent(state: AppState, classId: string, studentId: string) {
  const cls = state.classes.find((c) => c.id === classId)
  if (!cls) return
  cls.students = cls.students.filter((s) => s.id !== studentId)
  cls.rules = cls.rules
    .filter((r) => r.student !== studentId)
    .map((r) => ('others' in r ? { ...r, others: r.others.filter((o) => o !== studentId) } : r))
    .filter((r) => !('others' in r) || r.others.length > 0)
  for (const p of state.plans) {
    if (p.classId !== classId) continue
    delete p.assignment[studentId]
    p.pinned = p.pinned.filter((id) => id !== studentId)
  }
}

/** Changes a room's grid. Whatever pointed at a seat that no longer exists goes with it. */
export function reshapeRoom(state: AppState, roomId: string, rows: number, cols: number, seats: SeatKey[]) {
  const room = state.rooms.find((r) => r.id === roomId)
  if (!room) return
  room.rows = rows
  room.cols = cols
  room.seats = seats.filter((k) => parseSeat(k).row < rows && parseSeat(k).col < cols)
  const left = new Set(room.seats)
  for (const p of state.plans) {
    if (p.roomId !== roomId) continue
    p.blocked = p.blocked.filter((k) => left.has(k))
    for (const [student, seat] of Object.entries(p.assignment)) if (!left.has(seat)) delete p.assignment[student]
  }
  for (const c of state.classes) c.rules = c.rules.filter((r) => r.kind !== 'fixed' || r.roomId !== roomId || left.has(r.seat))
}

export function removeClass(state: AppState, classId: string) {
  state.classes = state.classes.filter((c) => c.id !== classId)
  state.plans = state.plans.filter((p) => p.classId !== classId)
}

export function removeRoom(state: AppState, roomId: string) {
  state.rooms = state.rooms.filter((r) => r.id !== roomId)
  state.plans = state.plans.filter((p) => p.roomId !== roomId)
  for (const c of state.classes) c.rules = c.rules.filter((r) => r.kind !== 'fixed' || r.roomId !== roomId)
}

const list = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`)

/** A rule as a German sentence. */
export function ruleText(rule: Rule, name: (id: string) => string, roomName: (id: string) => string): string {
  const who = name(rule.student)
  switch (rule.kind) {
    case 'beside':
      return rule.any
        ? `${who} sitzt neben mindestens einem von: ${rule.others.map(name).join(', ')}`
        : `${who} sitzt neben ${list(rule.others.map(name))}`
    case 'apart':
      return `${who} sitzt nicht ${rule.near ? 'in der Nähe von' : 'neben'} ${list(rule.others.map(name))}`
    case 'front':
      return rule.rows === 1 ? `${who} sitzt in der ersten Reihe` : `${who} sitzt in den ersten ${rule.rows} Reihen`
    case 'fixed': {
      const seat = parseSeat(rule.seat)
      return `${who} sitzt fest in Reihe ${seat.row + 1}, Platz ${seat.col + 1} (${roomName(rule.roomId)})`
    }
    case 'single':
      return `${who} hat einen Einzelplatz`
  }
}
