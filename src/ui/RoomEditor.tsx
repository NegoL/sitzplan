import { removeRoom, reshapeRoom } from '../domain/classroom'
import { update, useAppState } from '../store'
import { go, Missing, Page, SeatGrid } from './parts'

const MAX = 12

export function RoomEditor({ id }: { id: string }) {
  const state = useAppState()
  const room = state.rooms.find((r) => r.id === id)
  if (!room) return <Missing />
  const plans = state.plans.filter((p) => p.roomId === id).length

  const clamp = (n: number) => Math.min(MAX, Math.max(1, n))
  const resize = (rows: number, cols: number) => update((s) => reshapeRoom(s, id, clamp(rows), clamp(cols), room.seats))
  const toggle = (key: string) =>
    update((s) => reshapeRoom(s, id, room.rows, room.cols, room.seats.includes(key) ? room.seats.filter((k) => k !== key) : [...room.seats, key]))
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
          <input value={room.name} onInput={(e) => update((s) => void (s.rooms.find((r) => r.id === id)!.name = e.currentTarget.value))} />
        </label>
        <div class="steppers">
          <Stepper label="Reihen" value={room.rows} set={(v) => resize(v, room.cols)} />
          <Stepper label="Plätze je Reihe" value={room.cols} set={(v) => resize(room.rows, v)} />
        </div>
      </section>
      <section>
        <p class="soft">
          Tippe ein Feld an, um dort einen Platz zu setzen oder zu entfernen. Plätze direkt nebeneinander gelten als Sitznachbarn, ein leeres Feld
          dazwischen ist ein Gang. Entfernst du einen Platz, verschwindet auch ein fester Platz, der auf ihn zeigt. {room.seats.length} Plätze.
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
