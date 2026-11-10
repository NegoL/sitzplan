import { useState } from 'preact/hooks'
import { removeClass, removeStudent, ruleText } from '../domain/classroom'
import type { Plan, SchoolClass } from '../domain/types'
import { uid, update, useAppState } from '../store'
import { go, Missing, Page } from './parts'

const today = () => new Date().toLocaleDateString('de-DE')

export function ClassView({ id }: { id: string }) {
  const state = useAppState()
  const cls = state.classes.find((c) => c.id === id)
  const [editing, setEditing] = useState<string | null>(null)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [roomId, setRoomId] = useState('')
  const [planName, setPlanName] = useState('')
  if (!cls) return <Missing />

  const change = (fn: (c: SchoolClass) => void) => update((s) => fn(s.classes.find((c) => c.id === id)!))
  const plans = state.plans.filter((p) => p.classId === id).sort((a, b) => b.createdAt - a.createdAt)
  const name = (sid: string) => {
    const s = cls.students.find((x) => x.id === sid)
    return s ? `${s.first} ${s.last}`.trim() : '?'
  }
  const roomName = (rid: string) => state.rooms.find((r) => r.id === rid)?.name ?? 'gelöschter Raum'
  const sorted = [...cls.students].sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first, 'de'))

  const addStudent = (e: Event) => {
    e.preventDefault()
    if (!first.trim() && !last.trim()) return
    change((c) => void c.students.push({ id: uid(), first: first.trim(), last: last.trim() }))
    setFirst('')
    setLast('')
  }

  const addPlan = (e: Event) => {
    e.preventDefault()
    const room = roomId || state.rooms[0]?.id
    if (!room) return
    const plan: Plan = { id: uid(), name: planName.trim() || `Plan vom ${today()}`, classId: id, roomId: room, createdAt: Date.now(), assignment: {}, blocked: [], pinned: [] }
    update((s) => void s.plans.push(plan))
    setPlanName('')
    go(`plan/${plan.id}`)
  }

  const remove = () => {
    if (!confirm(`Klasse „${cls.name}“ mit allen Regeln und Plänen löschen?`)) return
    update((s) => removeClass(s, id))
    go('')
  }

  return (
    <Page title={cls.name || 'Klasse'} back="">
      <section>
        <label>
          Name der Klasse
          <input value={cls.name} onInput={(e) => change((c) => void (c.name = e.currentTarget.value))} />
        </label>
      </section>

      <section>
        <h2>Pläne</h2>
        {plans.length === 0 && <p class="soft">Noch kein Sitzplan für diese Klasse.</p>}
        <ul class="list">
          {plans.map((p) => (
            <li key={p.id}>
              <a href={`#/plan/${p.id}`}>
                <strong>{p.name}</strong>
                <span class="soft">
                  {roomName(p.roomId)}, {new Date(p.createdAt).toLocaleDateString('de-DE')}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {state.rooms.length === 0 ? (
          <p class="soft">
            Für einen Plan brauchst du einen Raum. <a href="#/">Lege auf der Startseite einen an.</a>
          </p>
        ) : (
          <form class="stack" onSubmit={addPlan}>
            <label>
              Raum
              <select value={roomId || state.rooms[0].id} onChange={(e) => setRoomId(e.currentTarget.value)}>
                {state.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.seats.length} Plätze)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Name des Plans
              <input value={planName} onInput={(e) => setPlanName(e.currentTarget.value)} placeholder={`Plan vom ${today()}`} />
            </label>
            <button class="primary">Neuen Plan anlegen</button>
          </form>
        )}
      </section>

      <section>
        <h2>Kinder ({cls.students.length})</h2>
        <a class="button" href={`#/klasse/${id}/import`}>
          Aus PDF oder Liste übernehmen
        </a>
        <ul class="list">
          {sorted.map((s) =>
            editing === s.id ? (
              <li key={s.id} class="edit">
                <input
                  value={s.first}
                  aria-label="Vorname"
                  placeholder="Vorname"
                  onInput={(e) => change((c) => void (c.students.find((x) => x.id === s.id)!.first = e.currentTarget.value))}
                />
                <input
                  value={s.last}
                  aria-label="Nachname"
                  placeholder="Nachname"
                  onInput={(e) => change((c) => void (c.students.find((x) => x.id === s.id)!.last = e.currentTarget.value))}
                />
                <div class="row">
                  <button onClick={() => setEditing(null)}>Fertig</button>
                  <button
                    class="danger"
                    onClick={() => {
                      if (confirm(`${name(s.id)} aus der Klasse entfernen? Regeln zu diesem Kind werden gelöscht.`)) update((st) => removeStudent(st, id, s.id))
                    }}
                  >
                    Entfernen
                  </button>
                </div>
              </li>
            ) : (
              <li key={s.id}>
                <button class="plain" onClick={() => setEditing(s.id)}>
                  {s.last ? `${s.last}, ${s.first}` : s.first}
                </button>
              </li>
            ),
          )}
        </ul>
        <form class="stack" onSubmit={addStudent}>
          <div class="row">
            <input value={first} onInput={(e) => setFirst(e.currentTarget.value)} placeholder="Vorname" aria-label="Vorname" />
            <input value={last} onInput={(e) => setLast(e.currentTarget.value)} placeholder="Nachname" aria-label="Nachname" />
          </div>
          <button>Kind hinzufügen</button>
        </form>
      </section>

      <section>
        <h2>Regeln ({cls.rules.length})</h2>
        {cls.rules.length === 0 && <p class="soft">Ohne Regeln werden die Kinder frei gemischt.</p>}
        <ul class="list">
          {cls.rules.map((r) => (
            <li key={r.id}>
              <a href={`#/klasse/${id}/regel/${r.id}`}>
                <span>{ruleText(r, name, roomName)}</span>
                <span class={`tag ${r.level}`}>{r.level === 'must' ? 'muss' : 'wäre schön'}</span>
              </a>
            </li>
          ))}
        </ul>
        {cls.students.length > 0 && (
          <a class="button" href={`#/klasse/${id}/regel/neu`}>
            Neue Regel
          </a>
        )}
      </section>

      <section>
        <button class="danger" onClick={remove}>
          Klasse löschen
        </button>
      </section>
    </Page>
  )
}
