import { parseSeat, type Room, type SeatKey } from '../domain/types'

export type PrintInput = {
  title: string
  date: string
  room: Room
  /** Seat → name to print. Seats without an entry are drawn empty. */
  names: Map<SeatKey, string>
}

// A4 landscape at 200 dpi. The plan is drawn with the browser's own fonts, so every name prints as typed.
const W = 2339
const H = 1654
const MARGIN = 90
const FONT = '"Atkinson Hyperlegible", sans-serif'

function draw({ title, date, room, names }: PrintInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#111'
  g.textBaseline = 'middle'

  g.font = `700 58px ${FONT}`
  g.textAlign = 'left'
  g.fillText(title, MARGIN, MARGIN + 30)
  g.font = `400 40px ${FONT}`
  g.textAlign = 'right'
  g.fillText(date, W - MARGIN, MARGIN + 30)

  const boardH = 80
  const top = MARGIN + 110
  const bottom = H - MARGIN - boardH - 50
  const seats = room.seats.map(parseSeat)
  const minCol = Math.min(...seats.map((s) => s.col))
  const cols = Math.max(...seats.map((s) => s.col)) - minCol + 1
  const minRow = Math.min(...seats.map((s) => s.row))
  const rows = Math.max(...seats.map((s) => s.row)) - minRow + 1
  let cw = (W - 2 * MARGIN) / cols
  let ch = (bottom - top) / rows
  ch = Math.min(ch, cw * 0.7)
  cw = Math.min(cw, ch * 2.4)
  const left = (W - cw * cols) / 2
  const gridBottom = top + ((bottom - top) + ch * rows) / 2

  g.textAlign = 'center'
  for (const key of room.seats) {
    const { row, col } = parseSeat(key)
    const x = left + (col - minCol) * cw + 8
    const y = gridBottom - (row - minRow + 1) * ch + 8
    const w = cw - 16
    const h = ch - 16
    const name = names.get(key)
    g.lineWidth = name ? 4 : 2
    g.strokeStyle = name ? '#111' : '#aaa'
    g.beginPath()
    g.roundRect(x, y, w, h, 14)
    g.stroke()
    if (!name) continue
    let size = Math.min(h * 0.42, 64)
    g.font = `700 ${size}px ${FONT}`
    while (size > 16 && g.measureText(name).width > w - 24) {
      size -= 2
      g.font = `700 ${size}px ${FONT}`
    }
    g.fillText(name, x + w / 2, y + h / 2, w - 16)
  }

  g.fillStyle = '#e6e6e6'
  g.fillRect(W * 0.2, H - MARGIN - boardH, W * 0.6, boardH)
  g.fillStyle = '#111'
  g.font = `700 40px ${FONT}`
  g.fillText('Tafel', W / 2, H - MARGIN - boardH / 2)
  return canvas
}

/** Renders the seating plan as a one-page A4 landscape PDF, board at the bottom. */
export async function planPdf(input: PrintInput): Promise<Blob> {
  await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 40px ${FONT}`)])
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  doc.addImage(draw(input).toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST')
  return doc.output('blob')
}

/** Hands a file to the Android share sheet; saves it as a download where sharing files is not possible. */
export async function shareFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
