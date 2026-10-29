import type { jsPDF as JsPdf } from 'jspdf'
import type { Cell } from 'jspdf-autotable'
import { formatTime12h } from '@/lib/business-time'
import type { RiderArea, RiderItem, RiderSheet } from '../production-admin/api'

/** One rider's part of the sheet: their name (may be empty) and their PIN codes in visiting order. */
export type RiderPart = { riderName: string; areas: RiderArea[]; load: RiderItem[] }

type Rgb = [number, number, number]
const BRAND: Rgb = [240, 120, 17]
const INK: Rgb = [31, 41, 55]
const MUTED: Rgb = [107, 114, 128]
const LINE: Rgb = [229, 231, 235]
const MINT: Rgb = [225, 245, 238]
const MINT_INK: Rgb = [8, 80, 65]
const AMBER: Rgb = [146, 64, 14]
const AMBER_BG: Rgb = [254, 243, 199]
const SOFT: Rgb = [246, 247, 249]
const MARGIN = 12

/**
 * The PDF uses the built-in Helvetica font, so the file stays small and nothing is downloaded for fonts. Helvetica only has Latin
 * letters: typographic punctuation is swapped for plain ASCII, and any other letters (for example Gujarati) become "?" and are
 * counted, so the screen can warn that those houses need checking.
 */
function plainText(value: string, unsupported: { count: number }): string {
  const swapped = value
    .replace(/[   ]/g, ' ')
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
  return swapped.replace(/[^\x20-\x7e -ÿ\n]/g, () => { unsupported.count += 1; return '?' })
}

/** "Thu, 29 Oct 2026" in English, whatever the admin language, because the PDF font has no Gujarati letters. */
const englishDate = (date: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const itemLine = (item: RiderItem) => `${item.productName} ${item.variantName}`

/** File name the browser saves: "Rider sheet - Evening - 29 Oct 2026 - Ramesh.pdf". Characters Windows refuses are removed. */
export function riderSheetFileName(sheet: RiderSheet, riderName: string): string {
  const parts = ['Rider sheet', sheet.slot.name, englishDate(sheet.date).replace(/^\w+, /, ''), riderName].filter(Boolean)
  return `${parts.join(' - ').replace(/[\\/:*?"<>|]/g, '')}.pdf`
}

/**
 * Builds the rider sheet PDF in the browser (nothing runs on the server) and saves it. Each rider starts on a new page: a header
 * with the window and day, what to load, then each PIN code with its houses in visiting order. Long addresses wrap inside their
 * column and the row grows, so nothing overlaps. Returns how many characters could not be shown.
 */
export async function downloadRiderSheetPdf(sheet: RiderSheet, parts: RiderPart[], fileName: string): Promise<{ unsupported: number }> {
  // Loaded only when someone downloads, so the page itself stays light.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const unsupported = { count: 0 }
  const text = (value: string) => plainText(value, unsupported)
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2
  const windowLabel = text(`${sheet.slot.name}  ${formatTime12h(sheet.slot.startTime)} - ${formatTime12h(sheet.slot.endTime)}`)
  const isFinal = sheet.status === 'final'

  parts.forEach((part, partIndex) => {
    if (partIndex > 0) doc.addPage()
    const houses = part.areas.reduce((sum, area) => sum + area.stops.length, 0)
    const pieces = part.load.reduce((sum, item) => sum + item.quantity, 0)
    let y = drawHeader(doc, { windowLabel, date: englishDate(sheet.date), riderName: text(part.riderName), isFinal, closesAt: sheet.closesAt })
    y = drawSummary(doc, y, [['Areas', String(part.areas.length)], ['Houses', String(houses)], ['Pieces to carry', String(pieces)]], contentWidth)

    // What to load, in big numbers, before the first house.
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Load in the vehicle', 'Qty']],
      body: part.load.map(item => [text(itemLine(item)), String(item.quantity)]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 11, textColor: INK, cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 } },
      headStyles: { fillColor: SOFT, textColor: MUTED, fontSize: 9, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold', fontSize: 14, cellWidth: 28 } },
      didDrawCell: data => { if (data.section === 'body') underline(doc, data.cell.x, data.cell.y + data.cell.height, data.cell.width) },
    })
    y = lastY(doc) + 5
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
    doc.text('Tick Yes when handed over. If No, write why: not home, refused or wrong address. Bring this sheet back to the office.', MARGIN, y, { maxWidth: contentWidth })
    y += 6

    let number = 1
    for (const area of part.areas) {
      // Keep the PIN band with at least its first house.
      if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = MARGIN + 4 }
      doc.setFillColor(...MINT)
      doc.roundedRect(MARGIN, y, contentWidth, 9, 1.5, 1.5, 'F')
      doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(...MINT_INK)
      doc.text(text(`PIN ${area.pinCode}${area.city ? `  ·  ${area.city}` : ''}`), MARGIN + 3, y + 6)
      doc.setFont('helvetica', 'normal').setFontSize(10)
      doc.text(plural(area.stops.length, 'house', 'houses'), pageWidth - MARGIN - 3, y + 6, { align: 'right' })
      y += 11
      doc.setFontSize(9).setTextColor(...MUTED)
      const areaLoad = doc.splitTextToSize(text(`For this area: ${area.load.map(item => `${itemLine(item)} x ${item.quantity}`).join(',  ')}`), contentWidth - 6)
      doc.text(areaLoad, MARGIN + 3, y + 3)
      y += areaLoad.length * 4 + 2

      const first = number
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN, top: MARGIN + 4 },
        head: [['#', 'Customer', 'Address and note', 'Give', 'Done']],
        body: area.stops.map((stop, index) => [
          String(first + index),
          text(`${stop.recipientName}${stop.kind === 'trial' ? '  (Trial)' : ''}${stop.recipientPhone ? `\n${stop.recipientPhone}` : ''}`),
          text([stop.addressLine1, stop.addressLine2, stop.landmark].filter(Boolean).join(', ') + (stop.doorstepNote ? `\nNote: ${stop.doorstepNote}` : '')),
          text(stop.items.map(item => `${item.quantity}  x  ${itemLine(item)}`).join('\n')),
          '',
        ]),
        theme: 'plain',
        rowPageBreak: 'avoid',
        showHead: 'everyPage',
        styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, valign: 'top', overflow: 'linebreak', cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 }, minCellHeight: 13 },
        headStyles: { fontSize: 8.5, fontStyle: 'bold', textColor: MUTED, fillColor: SOFT, minCellHeight: 0 },
        columnStyles: {
          0: { cellWidth: 9, textColor: MUTED },
          1: { cellWidth: 38 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 50, fontStyle: 'bold', fontSize: 10.5 },
          4: { cellWidth: 22 },
        },
        didDrawCell: data => {
          if (data.section !== 'body') return
          underline(doc, data.cell.x, data.cell.y + data.cell.height, data.cell.width)
          if (data.column.index === 2) recolourNote(doc, data.cell)
          if (data.column.index === 4) tickBoxes(doc, data.cell.x + 2, data.cell.y + 2.4)
        },
      })
      number += area.stops.length
      y = lastY(doc) + 7
    }

  })

  drawFooters(doc, windowLabel, englishDate(sheet.date))
  doc.save(fileName)
  return { unsupported: unsupported.count }
}

function drawHeader(doc: JsPdf, info: { windowLabel: string; date: string; riderName: string; isFinal: boolean; closesAt: string | null }): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageWidth, 3, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...BRAND)
  doc.text('SHREERAM MILKS', MARGIN, 12)
  doc.setFont('helvetica', 'normal').setTextColor(...MUTED)
  doc.text('Rider sheet', MARGIN + doc.getTextWidth('SHREERAM MILKS') + 4, 12)

  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK)
  doc.text(info.riderName || info.windowLabel, MARGIN, 22)
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED)
  doc.text(info.riderName ? `${info.windowLabel}   |   ${info.date}` : info.date, MARGIN, 29)

  // Final or draft, top right: a draft can still change, so riders must not trust it.
  const label = info.isFinal ? 'FINAL' : 'DRAFT - may change'
  doc.setFont('helvetica', 'bold').setFontSize(10)
  const width = doc.getTextWidth(label) + 8
  doc.setFillColor(...(info.isFinal ? MINT : AMBER_BG))
  doc.roundedRect(pageWidth - MARGIN - width, 15, width, 8, 2, 2, 'F')
  doc.setTextColor(...(info.isFinal ? MINT_INK : AMBER))
  doc.text(label, pageWidth - MARGIN - width / 2, 20.4, { align: 'center' })
  return 35
}

/** Three small number tiles under the header. */
function drawSummary(doc: JsPdf, y: number, tiles: Array<[string, string]>, width: number): number {
  const gap = 4
  const tileWidth = (width - gap * (tiles.length - 1)) / tiles.length
  tiles.forEach(([label, value], index) => {
    const x = MARGIN + index * (tileWidth + gap)
    doc.setFillColor(...SOFT)
    doc.roundedRect(x, y, tileWidth, 15, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
    doc.text(label, x + 3.5, y + 5.5)
    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK)
    doc.text(value, x + 3.5, y + 12.2)
  })
  return y + 20
}

/** "Yes" and "No" boxes for the rider to tick by hand. */
function tickBoxes(doc: JsPdf, x: number, y: number) {
  doc.setDrawColor(...MUTED).setLineWidth(0.3)
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED)
  doc.rect(x, y, 4.2, 4.2)
  doc.text('Yes', x + 5.2, y + 3.2)
  doc.rect(x + 10.5, y, 4.2, 4.2)
  doc.text('No', x + 15.7, y + 3.2)
}

/**
 * autoTable draws a cell in one colour. To show the doorstep note in amber, the note lines are painted over in amber after the
 * cell is drawn, at the same place autoTable put them.
 */
function recolourNote(doc: JsPdf, cell: Cell) {
  const noteStart = cell.text.findIndex(line => line.startsWith('Note: '))
  if (noteStart < 0) return
  const lineHeight = (cell.styles.fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor
  const top = cell.y + cell.padding('top')
  const left = cell.x + cell.padding('left')
  const lines = cell.text.slice(noteStart)
  const width = Math.max(...lines.map(line => doc.getTextWidth(line))) + 1
  doc.setFillColor(255, 255, 255)
  doc.rect(left - 0.3, top + noteStart * lineHeight, width, lines.length * lineHeight + 0.6, 'F')
  doc.setTextColor(...AMBER)
  lines.forEach((line, index) => doc.text(line, left, top + (noteStart + index) * lineHeight, { baseline: 'top' }))
}

function underline(doc: JsPdf, x: number, y: number, width: number) {
  doc.setDrawColor(...LINE).setLineWidth(0.25)
  doc.line(x, y, x + width, y)
}

function drawFooters(doc: JsPdf, windowLabel: string, date: string) {
  const pages = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const bottom = doc.internal.pageSize.getHeight() - 7
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED)
    doc.text(`ShreeRam Milks  |  ${windowLabel}  |  ${date}`, MARGIN, bottom)
    doc.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, bottom, { align: 'right' })
  }
}

const lastY = (doc: JsPdf) => (doc as JsPdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
