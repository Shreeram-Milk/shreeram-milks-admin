import type { jsPDF as JsPdf } from 'jspdf'
import type { Cell, CellInput, RowInput } from 'jspdf-autotable'
import { formatTime12h } from '@/lib/business-time'
import type { RiderArea, RiderItem, RiderSheet } from '../production-admin/api'

/** One rider's part of the sheet: their name (may be empty) and their PIN codes in visiting order. */
export type RiderPart = { riderName: string; areas: RiderArea[]; load: RiderItem[] }

type Rgb = [number, number, number]
const BRAND: Rgb = [240, 120, 17]
const INK: Rgb = [17, 24, 39]
const BODY: Rgb = [55, 65, 81]
const MUTED: Rgb = [107, 114, 128]
const GRID: Rgb = [218, 222, 228]
const MINT: Rgb = [236, 248, 243]
const MINT_INK: Rgb = [8, 80, 65]
const AMBER: Rgb = [146, 64, 14]
const AMBER_BG: Rgb = [254, 243, 199]
const SOFT: Rgb = [247, 248, 250]
const WHITE: Rgb = [255, 255, 255]
const MARGIN = 14
/** Up to this many product sizes each get their own number column; more than that are written out in one "Give" column. */
const MAX_PRODUCT_COLUMNS = 3

/** The admin's own font (Plus Jakarta Sans), served from /public and fetched only when someone downloads a sheet. */
const FONT = 'PlusJakarta'
const FONT_FILES = [
  { url: '/fonts/pdf/PlusJakartaSans-Regular.ttf', file: 'PlusJakartaSans-Regular.ttf', style: 'normal' },
  { url: '/fonts/pdf/PlusJakartaSans-Bold.ttf', file: 'PlusJakartaSans-Bold.ttf', style: 'bold' },
] as const

/**
 * Adds Plus Jakarta Sans to the PDF. If the font cannot be fetched (for example offline), the sheet still downloads with the
 * built-in Helvetica, so the rider always gets a sheet.
 */
async function loadBrandFont(doc: JsPdf): Promise<string> {
  try {
    const files = await Promise.all(FONT_FILES.map(async font => {
      const response = await fetch(font.url)
      if (!response.ok) throw new Error(`Font ${font.url}: ${response.status}`)
      return { ...font, data: toBase64(await response.arrayBuffer()) }
    }))
    for (const font of files) {
      doc.addFileToVFS(font.file, font.data)
      doc.addFont(font.file, FONT, font.style)
    }
    return FONT
  } catch {
    return 'helvetica'
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

/**
 * The font only has Latin letters: typographic punctuation is swapped for plain ASCII, and any other letters (for example Gujarati)
 * become "?" and are counted, so the screen can warn that those houses need checking.
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
 * Builds the rider sheet PDF in the browser (nothing runs on the server) and saves it. Each rider starts on a new page: a short
 * header, one line saying what to load, then one table of houses in visiting order. Each product size is named once, as a column,
 * so a row only carries numbers; each PIN code is a tinted divider row with its own totals. Long addresses wrap and the row grows.
 * Returns how many characters could not be shown.
 */
export async function downloadRiderSheetPdf(sheet: RiderSheet, parts: RiderPart[], fileName: string): Promise<{ unsupported: number }> {
  // Loaded only when someone downloads, so the page itself stays light.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const font = await loadBrandFont(doc)
  const unsupported = { count: 0 }
  const text = (value: string) => plainText(value, unsupported)
  const windowLabel = text(`${sheet.slot.name}, ${formatTime12h(sheet.slot.startTime)} - ${formatTime12h(sheet.slot.endTime)}`)
  const date = englishDate(sheet.date)

  parts.forEach((part, partIndex) => {
    if (partIndex > 0) doc.addPage()
    const houses = part.areas.reduce((sum, area) => sum + area.stops.length, 0)
    let y = drawHeader(doc, font, { title: text(part.riderName) || windowLabel, subtitle: part.riderName ? `${windowLabel}  ·  ${date}` : date, isFinal: sheet.status === 'final' })
    y = drawLoad(doc, font, y, text(part.load.map(item => `${item.quantity} x ${item.productName} ${item.variantName}`).join('    ·    ')), `${plural(part.areas.length, 'area', 'areas')}  ·  ${plural(houses, 'house', 'houses')}`)

    // Product sizes this rider carries, in load order. With few of them each gets a number column; otherwise one text column.
    const products = part.load.map(item => ({ key: keyOf(item), label: text(`${item.productName} ${item.variantName}`) }))
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
      const band = { fillColor: MINT, textColor: MINT_INK, fontStyle: 'bold' as const, fontSize: 8.5, valign: 'middle' as const, cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 } }
      body.push([
        { content: text(`PIN ${area.pinCode}${area.city ? `  ·  ${area.city}` : ''}  ·  ${plural(area.stops.length, 'house', 'houses')}`), colSpan: 3, styles: band },
        ...(asColumns
          ? products.map(product => ({ content: String(countOf(area.load, product.key) || ''), styles: { ...band, halign: 'center' as const } }))
          : [{ content: text(area.load.map(item => `${item.quantity} x ${item.productName} ${item.variantName}`).join(',  ')), styles: band }]),
        { content: '', styles: band },
      ])
      for (const stop of area.stops) {
        const give: CellInput[] = asColumns
          ? products.map(product => ({ content: String(countOf(stop.items, product.key) || ''), styles: { halign: 'center' as const, valign: 'middle' as const, fontSize: 11, fontStyle: 'bold' as const, textColor: INK } }))
          : [{ content: text(stop.items.map(item => `${item.quantity} x ${item.productName} ${item.variantName}`).join('\n')), styles: { fontStyle: 'bold' as const, textColor: INK } }]
        body.push([
          { content: String(number), styles: { halign: 'center', textColor: MUTED } },
          { content: text(`${stop.recipientName}${stop.recipientPhone ? `\n${stop.recipientPhone}` : ''}${stop.kind === 'trial' ? '\nTrial' : ''}`), styles: { fontStyle: 'bold', textColor: INK } },
          { content: text([stop.addressLine1, stop.addressLine2, stop.landmark].filter(Boolean).join(', ')) },
          ...give,
          '',
        ])
        number += 1
      }
    }

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 14 },
      head: [head],
      body,
      theme: 'grid',
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      styles: { font, fontSize: 8.5, textColor: BODY, valign: 'top', overflow: 'linebreak', lineColor: GRID, lineWidth: 0.2, cellPadding: { top: 2.4, bottom: 2.4, left: 2.5, right: 2.5 } },
      headStyles: { font, fontSize: 7.5, fontStyle: 'bold', textColor: MUTED, fillColor: SOFT, valign: 'middle' },
      bodyStyles: { fillColor: WHITE },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40 },
        2: { cellWidth: 'auto' },
        ...Object.fromEntries(Array.from({ length: giveColumns }, (_, index) => [3 + index, { cellWidth: asColumns ? 22 : 50 }])),
        [doneColumn]: { cellWidth: 13 },
      },
      didDrawCell: data => {
        if (data.section !== 'body' || isBand(data.cell)) return
        // The phone and any trial mark under a name are smaller and grey, so the name stands out.
        if (data.column.index === 1) quietLines(doc, font, data.cell, 1, MUTED)
        if (data.column.index === doneColumn) {
          doc.setDrawColor(...MUTED).setLineWidth(0.3)
          doc.roundedRect(data.cell.x + (data.cell.width - 4.5) / 2, data.cell.y + (data.cell.height - 4.5) / 2, 4.5, 4.5, 0.8, 0.8)
        }
      },
    })

    let end = lastY(doc) + 5
    if (end > doc.internal.pageSize.getHeight() - 22) { doc.addPage(); end = MARGIN + 4 }
    doc.setFont(font, 'normal').setFontSize(7.5).setTextColor(...MUTED)
    doc.text('Tick the box when delivered. Not delivered? Write the reason next to it: not home, refused or wrong address.', MARGIN, end, { maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2 })
  })

  drawFooters(doc, font, windowLabel, date)
  doc.save(fileName)
  return { unsupported: unsupported.count }
}

/** Brand line, the rider's name, the window and day, and whether the sheet is final. */
function drawHeader(doc: JsPdf, font: string, info: { title: string; subtitle: string; isFinal: boolean }): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageWidth, 1.6, 'F')
  doc.setFont(font, 'bold').setFontSize(7.5).setTextColor(...BRAND)
  doc.text('SHREERAM MILKS', MARGIN, 10)
  doc.setFont(font, 'normal').setTextColor(...MUTED)
  doc.text('Rider sheet', MARGIN + doc.getTextWidth('SHREERAM MILKS') + 2.5, 10)

  doc.setFont(font, 'bold').setFontSize(15).setTextColor(...INK)
  doc.text(info.title, MARGIN, 17.5)
  doc.setFont(font, 'normal').setFontSize(9).setTextColor(...MUTED)
  doc.text(info.subtitle, MARGIN, 22.5)

  // Final or draft, top right: a draft can still change, so riders must not trust it.
  const label = info.isFinal ? 'Final' : 'Draft - may change'
  doc.setFont(font, 'bold').setFontSize(8)
  const width = doc.getTextWidth(label) + 7
  doc.setFillColor(...(info.isFinal ? MINT : AMBER_BG))
  doc.roundedRect(pageWidth - MARGIN - width, 13, width, 6, 3, 3, 'F')
  doc.setTextColor(...(info.isFinal ? MINT_INK : AMBER))
  doc.text(label, pageWidth - MARGIN - width / 2, 16.9, { align: 'center' })

  doc.setDrawColor(...GRID).setLineWidth(0.2)
  doc.line(MARGIN, 27, pageWidth - MARGIN, 27)
  return 31
}

/** One quiet box: "Load" and everything to put in the vehicle on one line, with the areas and houses on the right. */
function drawLoad(doc: JsPdf, font: string, y: number, load: string, note: string): number {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2
  doc.setFont(font, 'normal').setFontSize(8)
  const noteWidth = doc.getTextWidth(note) + 4
  doc.setFont(font, 'bold').setFontSize(9)
  const lines = doc.splitTextToSize(load, width - 22 - noteWidth) as string[]
  const height = Math.max(9, lines.length * 4.4 + 4.6)
  doc.setFillColor(...SOFT)
  doc.roundedRect(MARGIN, y, width, height, 1.5, 1.5, 'F')
  doc.setFont(font, 'normal').setFontSize(7.5).setTextColor(...MUTED)
  doc.text('LOAD', MARGIN + 3.5, y + 5.6)
  doc.setFont(font, 'bold').setFontSize(9).setTextColor(...INK)
  doc.text(lines, MARGIN + 16, y + 5.8)
  doc.setFont(font, 'normal').setFontSize(8).setTextColor(...MUTED)
  doc.text(note, MARGIN + width - 3.5, y + 5.6, { align: 'right' })
  return y + height + 5
}

/** PIN code divider rows are the ones painted mint. */
const isBand = (cell: Cell) => Array.isArray(cell.styles.fillColor) && cell.styles.fillColor.every((value, index) => value === MINT[index])

/**
 * autoTable draws a cell in one colour. The lines from `from` on are painted over smaller and in a quieter colour, at the place
 * autoTable put them.
 */
function quietLines(doc: JsPdf, font: string, cell: Cell, from: number, colour: Rgb) {
  if (from >= cell.text.length) return
  const lineHeight = (cell.styles.fontSize * doc.getLineHeightFactor()) / doc.internal.scaleFactor
  const top = cell.y + cell.padding('top')
  const left = cell.x + cell.padding('left')
  const lines = cell.text.slice(from)
  doc.setFillColor(...WHITE)
  doc.rect(left - 0.3, top + from * lineHeight - 0.2, cell.width - cell.padding('horizontal') + 0.4, lines.length * lineHeight + 0.4, 'F')
  doc.setFont(font, 'normal').setFontSize(cell.styles.fontSize - 0.5).setTextColor(...colour)
  lines.forEach((line, index) => doc.text(line, left, top + (from + index) * lineHeight, { baseline: 'top' }))
}

function drawFooters(doc: JsPdf, font: string, windowLabel: string, date: string) {
  const pages = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const bottom = doc.internal.pageSize.getHeight() - 7
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont(font, 'normal').setFontSize(7).setTextColor(...MUTED)
    doc.text(`ShreeRam Milks  ·  ${windowLabel}  ·  ${date}`, MARGIN, bottom)
    doc.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, bottom, { align: 'right' })
  }
}

const lastY = (doc: JsPdf) => (doc as JsPdf & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
