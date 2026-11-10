import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { seatKey, type Room, type SeatKey } from '../domain/types'

export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      scrollTo(0, 0)
    }
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const go = (path: string) => {
  location.hash = path
}

export function Page({ title, back, children }: { title: string; back?: string; children: ComponentChildren }) {
  return (
    <>
      <header class="bar">
        {back !== undefined && (
          <a class="back" href={`#/${back}`} aria-label="Zurück">
            ‹
          </a>
        )}
        <h1>{title}</h1>
      </header>
      <main>{children}</main>
    </>
  )
}

export function Missing() {
  return (
    <Page title="Nicht gefunden" back="">
      <p>Diesen Eintrag gibt es nicht mehr.</p>
    </Page>
  )
}

export type Cell = { label?: string; class?: string; tappable?: boolean }

/** The room as seen from the board: front row at the bottom, board below it. */
export function SeatGrid(props: {
  room: Room
  /** Width of one cell in px. */
  size: number
  cell: (key: SeatKey, isSeat: boolean) => Cell
  onTap: (key: SeatKey, isSeat: boolean) => void
}) {
  const { room, size } = props
  const seats = new Set(room.seats)
  const cells = []
  for (let row = room.rows - 1; row >= 0; row--) {
    for (let col = 0; col < room.cols; col++) {
      const key = seatKey({ row, col })
      const isSeat = seats.has(key)
      const c = props.cell(key, isSeat)
      cells.push(
        c.tappable ? (
          <button key={key} type="button" class={`cell ${isSeat ? 'seat' : 'gap'} ${c.class ?? ''}`} onClick={() => props.onTap(key, isSeat)}>
            {c.label}
          </button>
        ) : (
          <div key={key} class={`cell ${isSeat ? 'seat' : 'gap'} ${c.class ?? ''}`}>
            {c.label}
          </div>
        ),
      )
    }
  }
  return (
    <div class="room" style={{ '--cell': `${size}px`, '--cols': room.cols }}>
      <div class="grid">{cells}</div>
      <div class="board">Tafel</div>
    </div>
  )
}
