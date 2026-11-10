export type Name = { last: string; first: string }
export type ListedClass = { label: string; students: Name[] }

const HEADING_WORD = /^(?:Klassenliste|Klasse|Kl\.)(?=[\s:])\s*:?\s*(\d{1,2}\s?[a-zA-Z]{0,2}|\S{1,8})(?=$|[\s(,:;–-])/i
const HEADING_BARE = /^(?:\d{1,2}\s?[a-zA-Z]{1,2}|EF|Q[1-4]|E[12]|\d{1,2}\.\d)$/
const NUMBERING = /^\s*\d+[.)]?\s+/
const WORD = "\\p{L}[\\p{L}'’.\\-]*"
const NAME_LINE = new RegExp(`^(${WORD}(?: ${WORD})*),\\s*(${WORD}(?: ${WORD})*)`, 'u')
const COLUMN_TITLES = new Set(['nachname', 'name', 'familienname'])
const PARTICLES = new Set(['von', 'van', 'de', 'der', 'den', 'zu', 'zur', 'di', 'da', 'del', 'le', 'la', 'al', 'el', 'ten'])

function heading(line: string): string | null {
  const text = line.trim()
  const m = HEADING_WORD.exec(text)
  if (m) return m[1].trim()
  return HEADING_BARE.test(text) ? text : null
}

function nameLine(line: string): Name | null {
  const m = NAME_LINE.exec(line.replace(NUMBERING, '').trim())
  if (!m || COLUMN_TITLES.has(m[1].toLowerCase())) return null
  return { last: m[1], first: m[2] }
}

/**
 * Reads a school-wide class list. `pages` holds the text lines of each page.
 * A class runs from its heading to the next class heading, across pages;
 * only lines of the form "Nachname, Vorname" count as students.
 */
export function parseClassList(pages: string[][]): ListedClass[] {
  const classes = new Map<string, ListedClass>()
  let current: ListedClass | null = null
  for (const line of pages.flat()) {
    const label = heading(line)
    if (label) {
      const key = label.toLowerCase().replace(/\s+/g, '')
      current = classes.get(key) ?? { label, students: [] }
      classes.set(key, current)
      continue
    }
    const name = current && nameLine(line)
    if (name) current!.students.push(name)
  }
  return [...classes.values()].filter((c) => c.students.length)
}

/** Reads a pasted list, one student per line, as "Nachname, Vorname" or "Vorname Nachname". */
export function parseNames(text: string): Name[] {
  const names: Name[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(NUMBERING, '').trim().replace(/\s+/g, ' ')
    if (!line) continue
    const comma = line.indexOf(',')
    if (comma >= 0) {
      names.push({ last: line.slice(0, comma).trim(), first: line.slice(comma + 1).trim() })
      continue
    }
    const words = line.split(' ')
    if (words.length === 1) {
      names.push({ last: '', first: line })
      continue
    }
    const particle = words.findIndex((w, i) => i > 0 && PARTICLES.has(w))
    const split = particle > 0 ? particle : words.length - 1
    names.push({ last: words.slice(split).join(' '), first: words.slice(0, split).join(' ') })
  }
  return names
}
