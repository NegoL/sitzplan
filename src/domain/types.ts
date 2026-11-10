/** A seat position in the room grid. Row 0 is the row nearest the board. */
export type Seat = { row: number; col: number }

/** Seat key in the form "row,col". */
export type SeatKey = string

export const seatKey = (s: Seat): SeatKey => `${s.row},${s.col}`
export const parseSeat = (k: SeatKey): Seat => {
  const [row, col] = k.split(',').map(Number)
  return { row, col }
}

export type Room = {
  id: string
  name: string
  rows: number
  cols: number
  /** Keys of the grid cells that are seats. Everything else is aisle. */
  seats: SeatKey[]
}

export type Student = { id: string; first: string; last: string }

export type Level = 'must' | 'nice'

export type Rule =
  /** Beside all of the others (at most two fit), or with `any` beside at least one of them. */
  | { id: string; kind: 'beside'; level: Level; student: string; others: string[]; any: boolean }
  /** Not beside any of the others; `near` also forbids in front, behind and diagonal. */
  | { id: string; kind: 'apart'; level: Level; student: string; others: string[]; near: boolean }
  /** Within the first `rows` rows. */
  | { id: string; kind: 'front'; level: Level; student: string; rows: number }
  /** On one seat. `roomId` names the room the seat was picked in; callers pass the rule only for that room. */
  | { id: string; kind: 'fixed'; level: Level; student: string; seat: SeatKey; roomId: string }
  /** Nobody directly left or right. */
  | { id: string; kind: 'single'; level: Level; student: string }

/** Student id → seat key. */
export type Assignment = Record<string, SeatKey>

export type SchoolClass = { id: string; name: string; students: Student[]; rules: Rule[] }

export type Plan = {
  id: string
  name: string
  classId: string
  roomId: string
  createdAt: number
  assignment: Assignment
  /** Seats nobody may use in this plan. */
  blocked: SeatKey[]
  /** Students the generator must leave where they are. */
  pinned: string[]
}

export type AppState = { classes: SchoolClass[]; rooms: Room[]; plans: Plan[] }
