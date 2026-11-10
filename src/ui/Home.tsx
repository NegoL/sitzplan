import { useRef, useState } from 'preact/hooks'
import { seatKey, type Room } from '../domain/types'
import { shareFile } from '../pdf/print'
import { backupJson, restoreBackup, uid, update, useAppState } from '../store'
import { go, Page } from './parts'

/** Five rows of three double desks with two aisles: a common starting point. */
function defaultRoom(name: string): Room {
  const seats: string[] = []
  for (let row = 0; row < 5; row++) for (const col of [0, 1, 3, 4, 6, 7]) seats.push(seatKey({ row, col }))
  return { id: uid(), name, rows: 5, cols: 8, seats }
}

export function Home() {
  const state = useAppState()
  const [name, setName] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const addClass = (e: Event) => {
    e.preventDefault()
    if (!name.trim()) return
    const id = uid()
    update((s) => void s.classes.push({ id, name: name.trim(), students: [], rules: [] }))
    setName('')
    go(`klasse/${id}`)
  }

  const addRoom = () => {
    const room = defaultRoom(`Raum ${state.rooms.length + 1}`)
    update((s) => void s.rooms.push(room))
    go(`raum/${room.id}`)
  }

  const exportBackup = () => {
    const day = new Date().toISOString().slice(0, 10)
    void shareFile(new Blob([backupJson()], { type: 'application/json' }), `sitzplan-sicherung-${day}.json`)
  }

  const importBackup = async () => {
    const f = file.current?.files?.[0]
    if (!f) return
    if (confirm('Die Sicherung ersetzt alle Klassen, Räume und Pläne auf diesem Gerät. Fortfahren?')) {
      try {
        restoreBackup(await f.text())
      } catch {
        alert('Diese Datei ist keine Sitzplan-Sicherung.')
      }
    }
    file.current!.value = ''
  }

  return (
    <Page title="Sitzplan">
      <section>
        <h2>Klassen</h2>
        {state.classes.length === 0 && <p class="soft">Noch keine Klasse. Lege unten die erste an.</p>}
        <ul class="list">
          {state.classes.map((c) => (
            <li key={c.id}>
              <a href={`#/klasse/${c.id}`}>
                <strong>{c.name}</strong>
                <span class="soft">
                  {c.students.length} Kinder, {state.plans.filter((p) => p.classId === c.id).length} Pläne
                </span>
              </a>
            </li>
          ))}
        </ul>
        <form class="row" onSubmit={addClass}>
          <input value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="Name der Klasse, z. B. 7b" aria-label="Name der neuen Klasse" />
          <button class="primary">Anlegen</button>
        </form>
      </section>

      <section>
        <h2>Räume</h2>
        {state.rooms.length === 0 && <p class="soft">Noch kein Raum. Ein Plan braucht einen Raum mit Plätzen.</p>}
        <ul class="list">
          {state.rooms.map((r) => (
            <li key={r.id}>
              <a href={`#/raum/${r.id}`}>
                <strong>{r.name}</strong>
                <span class="soft">{r.seats.length} Plätze</span>
              </a>
            </li>
          ))}
        </ul>
        <button onClick={addRoom}>Neuer Raum</button>
      </section>

      <section>
        <h2>Sicherung</h2>
        <p class="soft">Alle Daten liegen nur auf diesem Gerät. Sichere sie vor einem Handywechsel in eine Datei.</p>
        <div class="row">
          <button onClick={exportBackup}>Sicherung speichern</button>
          <button onClick={() => file.current?.click()}>Sicherung einlesen</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={importBackup} />
      </section>
    </Page>
  )
}
