import { useState } from 'preact/hooks'
import { parseClassList, parseNames, type ListedClass, type Name } from '../domain/classlist'
import { readPdfLines } from '../pdf/read'
import { uid, update, useAppState } from '../store'
import { go, Missing, Page } from './parts'

export function ImportView({ id }: { id: string }) {
  const state = useAppState()
  const cls = state.classes.find((c) => c.id === id)
  const [listed, setListed] = useState<ListedClass[] | null>(null)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState(cls?.name ?? '')
  const [text, setText] = useState('')
  const [review, setReview] = useState<Name[] | null>(null)
  if (!cls) return <Missing />

  const openPdf = async (file: File | undefined) => {
    if (!file) return
    setStatus('Lese PDF …')
    setListed(null)
    try {
      const found = parseClassList(await readPdfLines(file))
      setListed(found)
      setStatus(found.length ? '' : 'In diesem PDF habe ich keine Klassenüberschriften mit Namen im Format „Nachname, Vorname“ gefunden. Füge die Liste unten als Text ein.')
    } catch {
      setStatus('Das PDF ließ sich nicht lesen.')
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  const matches = listed?.filter((c) => norm(c.label).includes(norm(query))) ?? []

  const adopt = () => {
    const have = new Set(cls.students.map((s) => `${s.last}|${s.first}`))
    const fresh = review!.filter((n) => (n.first.trim() || n.last.trim()) && !have.has(`${n.last.trim()}|${n.first.trim()}`))
    update((s) => {
      const c = s.classes.find((x) => x.id === id)!
      for (const n of fresh) c.students.push({ id: uid(), first: n.first.trim(), last: n.last.trim() })
    })
    go(`klasse/${id}`)
  }

  if (review) {
    const edit = (i: number, part: keyof Name, value: string) => setReview(review.map((n, j) => (j === i ? { ...n, [part]: value } : n)))
    return (
      <Page title="Namen prüfen" back={`klasse/${id}`}>
        <section>
          <p class="soft">{review.length} Namen gefunden. Korrigiere sie hier, bevor du sie übernimmst. Kinder, die schon in der Klasse sind, werden übersprungen.</p>
          <ul class="list">
            {review.map((n, i) => (
              <li key={i} class="review">
                <input value={n.first} aria-label="Vorname" placeholder="Vorname" onInput={(e) => edit(i, 'first', e.currentTarget.value)} />
                <input value={n.last} aria-label="Nachname" placeholder="Nachname" onInput={(e) => edit(i, 'last', e.currentTarget.value)} />
                <button class="danger" aria-label={`${n.first} ${n.last} streichen`} onClick={() => setReview(review.filter((_, j) => j !== i))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div class="row">
            <button onClick={() => setReview(null)}>Zurück</button>
            <button class="primary" onClick={adopt} disabled={review.length === 0}>
              In die Klasse übernehmen
            </button>
          </div>
        </section>
      </Page>
    )
  }

  return (
    <Page title="Kinder übernehmen" back={`klasse/${id}`}>
      <section>
        <h2>Aus der Klassenliste als PDF</h2>
        <p class="soft">Das PDF wird nur auf diesem Gerät gelesen und nicht gespeichert.</p>
        <input type="file" accept="application/pdf,.pdf" aria-label="PDF auswählen" onChange={(e) => openPdf(e.currentTarget.files?.[0])} />
        {status && <p>{status}</p>}
        {listed && listed.length > 0 && (
          <>
            <label>
              Klasse
              <input value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder="z. B. 7b" />
            </label>
            {matches.length === 0 && <p class="soft">Keine Klasse passt zu „{query}“. Im PDF stehen {listed.length} Klassen.</p>}
            <ul class="list">
              {matches.slice(0, 30).map((c) => (
                <li key={c.label}>
                  <button class="plain" onClick={() => setReview(c.students)}>
                    <strong>{c.label}</strong> <span class="soft">{c.students.length} Namen</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Als Text einfügen</h2>
        <label>
          Ein Kind pro Zeile, als „Nachname, Vorname“ oder „Vorname Nachname“
          <textarea rows={8} value={text} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
        <button onClick={() => setReview(parseNames(text))} disabled={!text.trim()}>
          Namen prüfen
        </button>
      </section>
    </Page>
  )
}
