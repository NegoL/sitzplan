import { useState } from 'preact/hooks'
import type { Level, Rule } from '../domain/types'
import { uid, update, useAppState } from '../store'
import { go, Missing, Page, SeatGrid } from './parts'

type Kind = Rule['kind']

const KINDS: [Kind, string][] = [
  ['apart', 'sitzt nicht neben …'],
  ['beside', 'sitzt neben …'],
  ['front', 'sitzt vorn'],
  ['single', 'hat einen Einzelplatz'],
  ['fixed', 'sitzt auf einem festen Platz'],
]

export function RuleEditor({ classId, ruleId }: { classId: string; ruleId: string }) {
  const state = useAppState()
  const cls = state.classes.find((c) => c.id === classId)
  const existing = cls?.rules.find((r) => r.id === ruleId)
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'apart')
  const [student, setStudent] = useState(existing?.student ?? '')
  const [others, setOthers] = useState<string[]>(existing && 'others' in existing ? existing.others : [])
  const [near, setNear] = useState(existing?.kind === 'apart' ? existing.near : false)
  const [rows, setRows] = useState(existing?.kind === 'front' ? existing.rows : 1)
  const [roomId, setRoomId] = useState(existing?.kind === 'fixed' ? existing.roomId : (state.rooms[0]?.id ?? ''))
  const [seat, setSeat] = useState(existing?.kind === 'fixed' ? existing.seat : '')
  const [level, setLevel] = useState<Level>(existing?.level ?? 'must')
  if (!cls || (ruleId !== 'neu' && !existing)) return <Missing />

  const back = `klasse/${classId}`
  const sorted = [...cls.students].sort((a, b) => (a.first + a.last).localeCompare(b.first + b.last, 'de'))
  const room = state.rooms.find((r) => r.id === roomId)
  const needsOthers = kind === 'beside' || kind === 'apart'
  const ready = student && (!needsOthers || others.length > 0) && (kind !== 'fixed' || (room && seat))

  const build = (): Rule => {
    const base = { id: existing?.id ?? uid(), level, student }
    switch (kind) {
      case 'beside':
        return { ...base, kind, others }
      case 'apart':
        return { ...base, kind, others, near }
      case 'front':
        return { ...base, kind, rows }
      case 'fixed':
        return { ...base, kind, seat, roomId }
      case 'single':
        return { ...base, kind }
    }
  }

  const save = () => {
    const rule = build()
    update((s) => {
      const c = s.classes.find((x) => x.id === classId)!
      const i = c.rules.findIndex((r) => r.id === rule.id)
      if (i >= 0) c.rules[i] = rule
      else c.rules.push(rule)
    })
    go(back)
  }

  const remove = () => {
    update((s) => {
      const c = s.classes.find((x) => x.id === classId)!
      c.rules = c.rules.filter((r) => r.id !== ruleId)
    })
    go(back)
  }

  const toggleOther = (id: string) => setOthers(others.includes(id) ? others.filter((o) => o !== id) : [...others, id])

  return (
    <Page title={existing ? 'Regel ändern' : 'Neue Regel'} back={back}>
      <section class="stack">
        <label>
          Kind
          <select
            value={student}
            onChange={(e) => {
              setStudent(e.currentTarget.value)
              setOthers(others.filter((o) => o !== e.currentTarget.value))
            }}
          >
            <option value="">Bitte wählen</option>
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first} {s.last}
              </option>
            ))}
          </select>
        </label>
        <label>
          Regel
          <select value={kind} onChange={(e) => setKind(e.currentTarget.value as Kind)}>
            {KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {needsOthers && (
          <fieldset>
            <legend>{kind === 'beside' ? 'Neben wem?' : 'Neben wem nicht?'}</legend>
            <div class="chips">
              {sorted
                .filter((s) => s.id !== student)
                .map((s) => (
                  <button key={s.id} type="button" class={`chip ${others.includes(s.id) ? 'on' : ''}`} aria-pressed={others.includes(s.id)} onClick={() => toggleOther(s.id)}>
                    {s.first} {s.last}
                  </button>
                ))}
            </div>
            {kind === 'beside' && (
              <p class="soft">
                {others.length > 2
                  ? 'Bei mehr als zwei Kindern genügt es, wenn eines davon daneben sitzt.'
                  : 'Bei zwei Kindern sitzt das gewählte Kind in der Mitte.'}
              </p>
            )}
            {kind === 'apart' && <p class="soft">Die Regel gilt nur für das gewählte Kind. Die anderen dürfen untereinander nebeneinander sitzen.</p>}
          </fieldset>
        )}

        {kind === 'apart' && (
          <label class="check">
            <input type="checkbox" checked={near} onChange={(e) => setNear(e.currentTarget.checked)} />
            Auch nicht direkt davor, dahinter oder schräg
          </label>
        )}

        {kind === 'front' && (
          <label>
            Wie weit vorn?
            <select value={rows} onChange={(e) => setRows(Number(e.currentTarget.value))}>
              <option value={1}>In der ersten Reihe</option>
              <option value={2}>In den ersten 2 Reihen</option>
              <option value={3}>In den ersten 3 Reihen</option>
            </select>
          </label>
        )}

        {kind === 'single' && <p class="soft">Die Plätze direkt links und rechts bleiben frei. Davor und dahinter darf jemand sitzen.</p>}

        {kind === 'fixed' &&
          (state.rooms.length === 0 ? (
            <p>Für einen festen Platz brauchst du zuerst einen Raum.</p>
          ) : (
            <>
              <label>
                Raum
                <select
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.currentTarget.value)
                    setSeat('')
                  }}
                >
                  {state.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <p class="soft">Tippe den Platz an. Die Regel gilt nur in diesem Raum.</p>
              {room && (
                <div class="scroll">
                  <SeatGrid
                    room={room}
                    size={Math.max(30, Math.min(56, Math.floor(340 / room.cols)))}
                    cell={(key, isSeat) => ({ tappable: isSeat, class: key === seat ? 'selected' : '' })}
                    onTap={setSeat}
                  />
                </div>
              )}
            </>
          ))}

        <fieldset>
          <legend>Wie verbindlich?</legend>
          <label class="check">
            <input type="radio" name="level" checked={level === 'must'} onChange={() => setLevel('must')} />
            Muss erfüllt sein
          </label>
          <label class="check">
            <input type="radio" name="level" checked={level === 'nice'} onChange={() => setLevel('nice')} />
            Wäre schön
          </label>
        </fieldset>

        <button class="primary" onClick={save} disabled={!ready}>
          Regel speichern
        </button>
        {existing && (
          <button class="danger" onClick={remove}>
            Regel löschen
          </button>
        )}
      </section>
    </Page>
  )
}
