import { useEffect, useRef, useState } from 'preact/hooks'
import { displayNames, previousPlan, ruleText, rulesFor } from '../domain/classroom'
import { check, generate, rotation, type GenerateResult } from '../domain/seating'
import type { Assignment, Level, Plan, SeatKey } from '../domain/types'
import { planPdf, shareFile } from '../pdf/print'
import { update, useAppState } from '../store'
import { go, Missing, Page, SeatGrid } from './parts'

type Mode = 'swap' | 'pin' | 'block'

const MODES: [Mode, string, string][] = [
  ['swap', 'Tauschen', 'Tippe ein Kind an, dann ein zweites Kind oder einen freien Platz.'],
  ['pin', 'Fixieren', 'Tippe Kinder an, die beim Neu-Würfeln sitzen bleiben sollen.'],
  ['block', 'Sperren', 'Tippe freie Plätze an, die in diesem Plan leer bleiben sollen.'],
]

export function PlanView({ id }: { id: string }) {
  const state = useAppState()
  const plan = state.plans.find((p) => p.id === id)
  const cls = plan && state.classes.find((c) => c.id === plan.classId)
  const room = plan && state.rooms.find((r) => r.id === plan.roomId)
  const [mode, setMode] = useState<Mode>('swap')
  const [selected, setSelected] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [size, setSize] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Two-finger zoom changes the seat size instead of scaling the whole page.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let startDistance = 0
    let startSize = 0
    const distance = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      startDistance = distance(e)
      startSize = Number(getComputedStyle(el.firstElementChild!).getPropertyValue('--cell').replace('px', ''))
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDistance) return
      e.preventDefault()
      setSize(Math.round(Math.min(140, Math.max(34, (startSize * distance(e)) / startDistance))))
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [plan?.id])

  if (!plan || !cls || !room) return <Missing />

  // Only seats that still exist and children that are still in the class count.
  const seats = new Set(room.seats)
  const assignment: Assignment = {}
  const occupant = new Map<SeatKey, string>()
  for (const s of cls.students) {
    const seat = plan.assignment[s.id]
    if (seat && seats.has(seat) && !occupant.has(seat) && !plan.blocked.includes(seat)) {
      assignment[s.id] = seat
      occupant.set(seat, s.id)
    }
  }
  const unseated = cls.students.filter((s) => !assignment[s.id])
  const labels = displayNames(cls.students)
  const rules = rulesFor(cls, room.id)
  const violations = check(room, cls.students, rules, assignment)
  const mark = new Map<string, Level>()
  for (const v of violations) for (const s of v.students) if (mark.get(s) !== 'must') mark.set(s, v.level)
  const previous = previousPlan(state, plan)?.assignment
  const rotated = previous && occupant.size > 0 ? rotation(room, cls.students, previous, assignment) : null
  const fit = Math.max(34, Math.min(72, Math.floor((Math.min(innerWidth, 640) - 32) / room.cols) - 4))
  const cellSize = size || fit

  const change = (fn: (p: Plan) => void) => update((s) => fn(s.plans.find((p) => p.id === id)!))
  const fullName = (sid: string) => {
    const s = cls.students.find((x) => x.id === sid)
    return s ? `${s.first} ${s.last}`.trim() : '?'
  }

  const run = () => {
    setBusy(true)
    setSelected(null)
    // Let the "Rechne …" label paint before the search blocks the thread.
    setTimeout(() => {
      const res = generate({
        room,
        students: cls.students,
        rules,
        blocked: plan.blocked,
        pinned: Object.fromEntries(plan.pinned.filter((s) => assignment[s]).map((s) => [s, assignment[s]])),
        previous,
        seed: Math.floor(Math.random() * 2 ** 31),
      })
      change((p) => void (p.assignment = res.assignment))
      setResult(res)
      setBusy(false)
    }, 30)
  }

  const tap = (key: SeatKey) => {
    const there = occupant.get(key)
    if (mode === 'block') {
      if (there) return
      change((p) => void (p.blocked = p.blocked.includes(key) ? p.blocked.filter((k) => k !== key) : [...p.blocked, key]))
      return
    }
    if (plan.blocked.includes(key)) return
    if (mode === 'pin') {
      if (there) change((p) => void (p.pinned = p.pinned.includes(there) ? p.pinned.filter((s) => s !== there) : [...p.pinned, there]))
      return
    }
    if (!selected) {
      if (there) setSelected(there)
      return
    }
    if (selected !== there) {
      const from = assignment[selected]
      change((p) => {
        p.assignment = { ...assignment, [selected]: key }
        if (there) {
          if (from) p.assignment[there] = from
          else delete p.assignment[there]
        }
      })
      setResult(null)
    }
    setSelected(null)
  }

  const pdf = async () => {
    setBusy(true)
    try {
      const names = new Map([...occupant].map(([seat, s]) => [seat, labels.get(s)!]))
      const date = new Date().toLocaleDateString('de-DE')
      const blob = await planPdf({ title: `${cls.name} – ${plan.name}`, date, room, names })
      await shareFile(blob, `Sitzplan ${cls.name} ${plan.name}.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
    } catch (e) {
      alert(`Das PDF ließ sich nicht erzeugen: ${e}`)
    }
    setBusy(false)
  }

  const remove = () => {
    if (!confirm(`Plan „${plan.name}“ löschen?`)) return
    update((s) => void (s.plans = s.plans.filter((p) => p.id !== id)))
    go(`klasse/${cls.id}`)
  }

  const must = violations.filter((v) => v.level === 'must').length
  const nice = violations.length - must
  const missing = cls.students.length - room.seats.filter((k) => !plan.blocked.includes(k)).length
  const roomName = () => room.name
  const empty = occupant.size === 0

  return (
    <Page title={`${cls.name} – ${plan.name}`} back={`klasse/${cls.id}`}>
      <section>
        <div class="row">
          <button class="primary" onClick={run} disabled={busy || cls.students.length === 0}>
            {busy ? 'Rechne …' : empty ? 'Vorschlag erzeugen' : 'Neu würfeln'}
          </button>
          <button onClick={pdf} disabled={busy || empty}>
            PDF teilen
          </button>
        </div>
        {cls.students.length === 0 && <p class="soft">Diese Klasse hat noch keine Kinder.</p>}
        {missing > 0 && (
          <p class="alert">
            Der Raum hat {missing === 1 ? 'einen Platz' : `${missing} Plätze`} zu wenig für {cls.students.length} Kinder.
          </p>
        )}
        {rotated && rotated.total > 0 && (
          <p class="soft">
            {rotated.newNeighbours} von {rotated.total} Kindern haben neue Sitznachbarn gegenüber dem letzten Plan in diesem Raum.
          </p>
        )}
        {violations.length > 0 && (
          <p class={must ? 'alert' : 'soft'}>
            {[must && `${must}-mal Muss-Regel verletzt`, nice && `${nice}-mal Wunsch nicht erfüllt`].filter(Boolean).join(', ')}.
            {!showRules && ' Blende die Regeln ein, um zu sehen, wo.'}
          </p>
        )}
        {result && result.conflict.length > 0 && (
          <p class="alert">
            {result.conflict.length === 1
              ? 'Eine Muss-Regel lässt sich in diesem Raum nicht erfüllen.'
              : `${result.conflict.length} Muss-Regeln lassen sich in diesem Raum nicht gemeinsam erfüllen.`}
            {!showRules && ' Blende die Regeln ein, um zu sehen, welche.'}
          </p>
        )}
      </section>

      <section>
        <div class="segments" role="group" aria-label="Was Antippen bewirkt">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              class={mode === m ? 'on' : ''}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                setSelected(null)
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p class="soft">{MODES.find(([m]) => m === mode)![2]}</p>
        <div class="scroll" ref={scroller}>
          <SeatGrid
            room={room}
            size={cellSize}
            cell={(key, isSeat) => {
              if (!isSeat) return {}
              const s = occupant.get(key)
              const classes = [
                s ? 'taken' : '',
                plan.blocked.includes(key) ? 'blocked' : '',
                s && plan.pinned.includes(s) ? 'pinned' : '',
                s && s === selected ? 'selected' : '',
                s && showRules && mark.has(s) ? `broken-${mark.get(s)}` : '',
              ]
              return { tappable: true, label: s ? labels.get(s) : '', class: classes.join(' ') }
            }}
            onTap={tap}
          />
        </div>
        <div class="row zoom">
          <button onClick={() => setSize(Math.max(34, cellSize - 12))} aria-label="Kleiner">
            −
          </button>
          <button onClick={() => setSize(Math.min(140, cellSize + 12))} aria-label="Größer">
            +
          </button>
          <span class="soft">oder mit zwei Fingern zoomen</span>
        </div>
        {unseated.length > 0 && (
          <>
            <h2>Ohne Platz ({unseated.length})</h2>
            <div class="chips">
              {unseated.map((s) => (
                <button key={s.id} class={`chip ${selected === s.id ? 'on' : ''}`} onClick={() => mode === 'swap' && setSelected(selected === s.id ? null : s.id)}>
                  {labels.get(s.id)}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <label class="check">
          <input type="checkbox" checked={showRules} onChange={(e) => setShowRules(e.currentTarget.checked)} />
          Regeln einblenden
        </label>
        {showRules && (
          <ul class="list rules">
            {rules.length === 0 && <li class="soft">Für diese Klasse gibt es keine Regeln.</li>}
            {rules.map((r) => {
              const broken = violations.filter((v) => v.ruleId === r.id)
              return (
                <li key={r.id} class={broken.length ? `broken-${r.level}` : ''}>
                  <span>
                    {ruleText(r, fullName, roomName)}
                    {broken.length > 0 && <em> – verletzt bei {broken.map((v) => v.students.map((s) => labels.get(s)).join(' und ')).join('; ')}</em>}
                    {result?.conflict.includes(r.id) && <em> – Teil des Widerspruchs</em>}
                  </span>
                  <span class={`tag ${r.level}`}>{r.level === 'must' ? 'muss' : 'wäre schön'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section class="stack">
        <label>
          Name des Plans
          <input value={plan.name} onInput={(e) => change((p) => void (p.name = e.currentTarget.value))} />
        </label>
        <button class="danger" onClick={remove}>
          Plan löschen
        </button>
      </section>
    </Page>
  )
}
