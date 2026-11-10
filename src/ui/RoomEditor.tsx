import { removeRoom } from '../domain/classroom'
import { parseSeat, type Room } from '../domain/types'
import { update, useAppState } from '../store'
import { go, Missing, Page, SeatGrid } from './parts'

const MAX = 12

export function RoomEditor({ id }: { id: string }) {
  const state = useAppState()
  const room = state.rooms.find((r) => r.id === id)
  if (!room) return <Missing />
  const plans = state.plans.filter((p) => p.roomId === id).length

  const change = (fn: (r: Room) => void) => update((s) => fn(s.rooms.find((r) => r.id === id)!))
  const resize = (rows: number, cols: number) =>
    change((r) => {
      r.rows = Math.min(MAX, Math.max(1, rows))
      r.cols = Math.min(MAX, Math.max(1, cols))
      r.seats = r.seats.filter((k) => parseSeat(k).row < r.rows && parseSeat(k).col < r.cols)
    })
  const toggle = (key: string) =>
    change((r) => {
      r.seats = r.seats.includes(key) ? r.seats.filter((k) => k !== key) : [...r.seats, key]
    })
  const remove = () => {
    const warning = plans ? `„${room.name}“ löschen? ${plans === 1 ? 'Ein Plan' : `${plans} Pläne`} in diesem Raum gehen mit verloren.` : `„${room.name}“ löschen?`
    if (!confirm(warning)) return
    update((s) => removeRoom(s, id))
    go('')
  }

  return (
    <Page title="Raum" back="">
      <section>
        <label>
          Name
          <input value={room.name} onInput={(e) => change((r) => void (r.name = e.currentTarget.value))} />
        </label>
        <div class="steppers">
          <Stepper label="Reihen" value={room.rows} set={(v) => resize(v, room.cols)} />
          <Stepper label="Plätze je Reihe" value={room.cols} set={(v) => resize(room.rows, v)} />
        </div>
      </section>
      <section>
        <p class="soft">
          Tippe ein Feld an, um dort einen Platz zu setzen oder zu entfernen. Plätze direkt nebeneinander gelten als Sitznachbarn, ein leeres Feld
          dazwischen ist ein Gang. {room.seats.length} Plätze.
        </p>
        <div class="scroll">
          <SeatGrid room={room} size={Math.max(30, Math.min(56, Math.floor(340 / room.cols)))} cell={() => ({ tappable: true })} onTap={toggle} />
        </div>
      </section>
      <section>
        <button class="danger" onClick={remove}>
          Raum löschen
        </button>
      </section>
    </Page>
  )
}

function Stepper({ label, value, set }: { label: string; value: number; set: (v: number) => void }) {
  return (
    <div class="stepper">
      <span>{label}</span>
      <button type="button" onClick={() => set(value - 1)} aria-label={`${label} verringern`}>
        −
      </button>
      <output>{value}</output>
      <button type="button" onClick={() => set(value + 1)} aria-label={`${label} erhöhen`}>
        +
      </button>
    </div>
  )
}
