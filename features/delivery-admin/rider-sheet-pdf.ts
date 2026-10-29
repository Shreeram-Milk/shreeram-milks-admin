import type { jsPDF as JsPdf } from 'jspdf'
import type { Cell, CellInput, RowInput } from 'jspdf-autotable'
import { formatTime12h } from '@/lib/business-time'
import type { RiderArea, RiderItem, RiderSheet } from '../production-admin/api'

/** One rider's part of the sheet: their name (may be empty) and their PIN codes in visiting order. */
export type RiderPart = { riderName: string; areas: RiderArea[]; load: RiderItem[] }

type Rgb = [number, number, number]
const BRAND: Rgb = [240, 120, 17]
const INK: Rgb = [17, 24, 39]
const MUTED: Rgb = [107, 114, 128]
const LINE: Rgb = [229, 231, 235]
const MINT: Rgb = [225, 245, 238]
const MINT_INK: Rgb = [8, 80, 65]
const AMBER: Rgb = [146, 64, 14]
const AMBER_BG: Rgb = [254, 243, 199]
const SOFT: Rgb = [246, 247, 249]
const WHITE: Rgb = [255, 255, 255]
const MARGIN = 12
/** Up to this many product sizes each get their own number column; more than that are written out in one "Give" column. */
const MAX_PRODUCT_COLUMNS = 3

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
const keyOf = (item: Pick<RiderItem, 'productId' | 'variantId'>) => `${item.productId}|${item.variantId}`
const countOf = (items: RiderItem[], key: string) => items.filter(item => keyOf(item) === key).reduce((sum, item) => sum + item.quantity, 0)

/** File name the browser saves: "Rider sheet - Evening - 29 Oct 2026 - Ramesh.pdf". Characters Windows refuses are removed. */
export function riderSheetFileName(sheet: RiderSheet, riderName: string): string {
  const parts = ['Rider sheet', sheet.slot.name, englishDate(sheet.date).replace(/^\w+, /, ''), riderName].filter(Boolean)
  return `${parts.join(' - ').replace(/[\\/:*?"<>|]/g, '')}.pdf`
}

/**
 * Builds the rider sheet PDF in the browser (nothing runs on the server) and saves it. Each rider starts on a new page with what to
 * load, then one table of houses in visiting order. Each product size is named once, as a column, so a row only carries numbers;
 * each PIN code is a coloured divider row with its own totals. Long addresses wrap and the row grows, so nothing overlaps.
 * Returns how many characters could not be shown.
 */
export async function downloadRiderSheetPdf(sheet: RiderSheet, parts: RiderPart[], fileName: string): Promise<{ unsupported: number }> {
  // Loaded only when someone downloads, so the page itself stays light.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const unsupported = { count: 0 }
  const text = (value: string) => plainText(value, unsupported)
  const windowLabel = text(`${sheet.slot.name}, ${formatTime12h(sheet.slot.startTime)} to ${formatTime12h(sheet.slot.endTime)}`)
  const date = englishDate(sheet.date)

  parts.forEach((part, partIndex) => {
    if (partIndex > 0) doc.addPage()
    const houses = part.areas.reduce((sum, area) => sum + area.stops.length, 0)
    let y = drawHeader(doc, { title: text(part.riderName) || windowLabel, subtitle: part.riderName ? `${windowLabel}   |   ${date}` : date, isFinal: sheet.status === 'final' })
    y = drawLoad(doc, y, part.load.map(item => ({ count: item.quantity, name: text(item.productName), size: text(item.variantName) })), `${plural(part.areas.length, 'area', 'areas')}  ·  ${plural(houses, 'house', 'houses')}`)

    // Product sizes this rider carries, in load order. With few of them each gets a number column; otherwise one text column.
    const products = part.load.map(item => ({ key: keyOf(item), label: text(`${item.productName}\n${item.variantName}`) }))
    const asColumns = products.length <= MAX_PRODUCT_COLUMNS
    const giveColumns = asColumns ? products.length : 1
    const doneColumn = 3 + giveColumns

    const head: RowInput = [
      { content: '#', styles: { halign: 'center' } },
      'Customer',
      'Address',
      ...(asColumns ? products.map(product => ({ content: product.label, styles: { halign: 'center' as const } })) : ['Give']),
      { content: 'Done', styles: { halign: 'center' } },
    ]

    const body: RowInput[] = []
    let number = 1
    for (const area of part.areas) {
      const band = { fillColor: MINT, textColor: MINT_INK, fontStyle: 'bold' as const, minCellHeight: 9, valign: 'middle' as const }
      body.push([
        { content: text(`PIN ${area.pinCode}${area.city ? `  ·  ${area.city}` : ''}     ${plural(area.stops.length, 'house', 'houses')}`), colSpan: 3, styles: { ...band, fontSize: 10.5 } },
        ...(asColumns
          ? products.map(product => ({ content: String(countOf(area.load, product.key) || ''), styles: { ...band, halign: 'center' as const, fontSize: 11 } }))
          : [{ content: text(area.load.map(item => `${item.quantity} x ${item.productName} ${item.variantName}`).join(',  ')), styles: { ...band, fontSize: 9 } }]),
        { content: '', styles: band },
      ])
      for (const stop of area.stops) {
        const address = [stop.addressLine1, stop.addressLine2, stop.landmark].filter(Boolean).join(', ')
        const give: CellInput[] = asColumns
          ? products.map(product => ({ content: String(countOf(stop.items, product.key) || ''), styles: { halign: 'center' as const, fontSize: 15, fontStyle: 'bold' as const } }))
          : [{ content: text(stop.items.map(item => `${item.quantity} x ${item.productName} ${item.variantName}`).join('\n')), styles: { fontStyle: 'bold' as const } }]
        body.push([
          { content: String(number), styles: { halign: 'center', textColor: MUTED } },
          { content: text(`${stop.recipientName}${stop.recipientPhone ? `\n${stop.recipientPhone}` : ''}${stop.kind === 'trial' ? '\nTRIAL' : ''}`) },
          { content: text(address) },
          ...give,
          '',
        ])
        number += 1
      }
    }

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN + 6, bottom: 14 },
      head: [head],
      body,
      theme: 'plain',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: { font: 'helvetica', fontSize: 9.5, textColor: INK, valign: 'top', overflow: 'linebreak', cellPadding: { top: 3, bottom: 3, left: 2.2, right: 2.2 }, lineColor: LINE },
      headStyles: { fontSize: 8, fontStyle: 'bold', textColor: MUTED, fillColor: SOFT, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 9 },
        1: { cellWidth: 42 },
        2: { cellWidth: 'auto' },
        ...Object.fromEntries(Array.from({ length: giveColumns }, (_, index) => [3 + index, { cellWidth: asColumns ? 22 : 52 }])),
        [doneColumn]: { cellWidth: 14 },
      },
      didParseCell: data => {
        // The customer's name stands out; the phone and any trial mark under it are smaller.
        if (data.section === 'body' && data.column.index === 1 && data.cell.colSpan === 1) data.cell.styles.fontStyle = 'bold'
      },
      didDrawCell: data => {
        if (data.section !== 'body') return
        const isBand = Array.isArray(data.cell.styles.fillColor) && data.cell.styles.fillColor[0] === MINT[0]
        if (!isBand) underline(doc, data.cell.x, data.cell.y + data.cell.height, data.cell.width)
        if (isBand) return
        if (data.column.index === 1) quietLines(doc, data.cell, 1, MUTED)
        if (data.column.index === doneColumn) {
          doc.setDrawColor(...MUTED).setLineWidth(0.35)
          doc.roundedRect(data.cell.x + (data.cell.width - 6) / 2, data.cell.y + 3, 6, 6, 1, 1)
        }
      },
    })

    let end = lastY(doc) + 6
    if (end > doc.internal.pageSize.getHeight() - 24) { doc.addPage(); end = MARGIN + 6 }
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED)
    doc.text('Tick the box when delivered. Not delivered? Write the reason beside the box: not home, refused or wrong address.', MARGIN, end, { maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2 })
  })

  drawFooters(doc, windowLabel, date)
  doc.save(fileName)
  return { unsupported: unsupported.count }
}

function drawHeader(doc: JsPdf, info: { title: string; subtitle: string; isFinal: boolean }): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageWidth, 2.5, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BRAND)
  doc.text('SHREERAM MILKS', MARGIN, 11)
  doc.setFont('helvetica', 'normal').setTextColor(...MUTED)
  doc.text('RIDER SHEET', MARGIN + doc.getTextWidth('SHREERAM MILKS') + 3, 11)

  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...INK)
  doc.text(info.title, MARGIN, 21)
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED)
  doc.text(info.subtitle, MARGIN, 28)

  // Final or draft, top right: a draft can still change, so riders must not trust it.
  const label = info.isFinal ? 'FINAL' : 'DRAFT - may change'
  doc.setFont('helvetica', 'bold').setFontSize(10)
  const width = doc.getTextWidth(label) + 8
  doc.setFillColor(...(info.isFinal ? MINT : AMBER_BG))
  doc.roundedRect(pageWidth - MARGIN - width, 14, width, 8, 2, 2, 'F')
  doc.setTextColor(...(info.isFinal ? MINT_INK : AMBER))
  doc.text(label, pageWidth - MARGIN - width / 2, 19.4, { align: 'center' })
  return 34
}

/** "Load in the vehicle": one tile per product size with its count in large figures, and the areas and houses on the right. */
function drawLoad(doc: JsPdf, y: number, items: Array<{ count: number; name: string; size: string }>, note: string): number {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...MUTED)
  doc.text('LOAD IN THE VEHICLE', MARGIN, y + 3)
  doc.setFont('helvetica', 'normal')
  doc.text(note, MARGIN + width, y + 3, { align: 'right' })
  y += 6
  const perRow = Math.min(Math.max(items.length, 1), 3)
  const gap = 4
  const tileWidth = (width - gap * (perRow - 1)) / perRow
  items.forEach((item, index) => {
    const x = MARGIN + (index % perRow) * (tileWidth + gap)
    const top = y + Math.floor(index / perRow) * 20
    doc.setFillColor(...SOFT)
    doc.roundedRect(x, top, tileWidth, 17, 2, 2, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...INK)
    doc.text(String(item.count), x + 5, top + 11.5)
    const textX = x + 7 + doc.getTextWidth(String(item.count))
    doc.setFontSize(10.5).text(item.name, textX, top + 7.5, { maxWidth: tileWidth - (textX - x) - 3 })
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED)
    doc.text(item.size, textX, top + 12.5)
  })
  return y + Math.ceil(items.length / perRow) * 20 + 2
}

/**
 * autoTable draws a cell in one colour. The lines from `from` on (the phone and any trial mark under a name) are painted over
 * smaller and in a quieter colour, at the place autoTable put them, so the name stands out.
 */
function quietLines(doc: JsPdf, cell: Cell, from: number, colour: Rgb) {
  if (from >= cell.text.length) return
  const lineHeight = (cell.styles.fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor
  const top = cell.y + cell.padding('top')
  const left = cell.x + cell.padding('left')
  const lines = cell.text.slice(from)
  doc.setFillColor(...WHITE)
  doc.rect(left - 0.3, top + from * lineHeight - 0.2, cell.width - cell.padding('horizontal') + 0.6, lines.length * lineHeight + 0.6, 'F')
  doc.setFont('helvetica', 'normal').setFontSize(cell.styles.fontSize - 1).setTextColor(...colour)
  lines.forEach((line, index) => doc.text(line, left, top + (from + index) * lineHeight, { baseline: 'top' }))
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
