type TextItem = { str: string; transform: number[]; width: number }

/** Joins the positioned text fragments of one page into lines, top to bottom; wide gaps become tabs. */
function lines(items: TextItem[]): string[] {
  const rows: { y: number; items: TextItem[] }[] = []
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = item.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) < 3)
    if (row) row.items.push(item)
    else rows.push({ y, items: [item] })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((row) => {
    row.items.sort((a, b) => a.transform[4] - b.transform[4])
    let text = ''
    let end = 0
    for (const item of row.items) {
      const gap = item.transform[4] - end
      if (text) text += gap > 8 ? '\t' : gap > 1 && !text.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : ''
      text += item.str
      end = item.transform[4] + item.width
    }
    return text
  })
}

/** Reads the text lines of every page of a PDF, entirely on the device. */
export async function readPdfLines(file: File): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages: string[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    pages.push(lines(content.items.filter((i): i is typeof i & TextItem => 'str' in i)))
  }
  await doc.loadingTask.destroy()
  return pages
}
