import type { RiderStop, RiderSheet } from '../production-admin/api'
import type { RiderPart } from './rider-sheet-pdf'
import { riderDeliverySections, riderStopAddress, riderLoadText, type RiderSection } from './rider-stop-groups'

/** Browser shaping keeps Gujarati and every original Unicode address intact. The print dialog offers Save as PDF. */
export function printUnicodeRiderSheet(sheet: RiderSheet, parts: RiderPart[], fileName: string): void {
  const preview = window.open('', '_blank')
  if (!preview) throw new Error('Allow the print preview window, then try again.')
  preview.opener = null
  const doc = preview.document
  doc.title = fileName.replace(/\.pdf$/i, '')
  doc.documentElement.lang = 'gu'
  doc.documentElement.className = document.documentElement.className
  doc.body.className = document.body.className
  // Reuse the loaded page's font faces and variables. Copying Next's managed stylesheet links into
  // about:blank can leave their load events pending forever, preventing the print dialog from opening.
  const pageStyle = getComputedStyle(document.body)
  const gujaratiFamily = pageStyle.getPropertyValue('--font-noto-sans-gujarati').trim()
  if (gujaratiFamily) doc.documentElement.style.setProperty('--font-noto-sans-gujarati', gujaratiFamily)
  document.fonts.forEach(face => doc.fonts.add(face))
  const style = doc.createElement('style')
  style.textContent = `@page { size: A4; margin: 14mm; } html,body { height:auto!important; overflow:visible!important; background:white!important; color:#111!important; } body { margin:0; font-family:var(--font-noto-sans-gujarati),Arial,sans-serif; font-size:11px; line-height:1.55; } h1 { font:700 22px var(--font-noto-sans-gujarati),Arial,sans-serif; margin:0 0 5px; } h2 { font-size:16px; margin:20px 0 8px; } p { margin:5px 0 12px; } section+section { break-before:page; } table { border-collapse:collapse; width:100%; min-width:0!important; margin-bottom:20px; } th,td { white-space:normal!important; border:1px solid #d8dde3; padding:8px; font-size:11px; vertical-align:top; overflow-wrap:anywhere; } th { background:#f5f6f8; text-align:left; } thead { display:table-header-group; } tr { break-inside:avoid; } .group td { background:#edf7f2; font-weight:700; } .group { break-after:avoid; } .load { border:1px solid #d8dde3; padding:10px; } small { display:block; color:#444; } button { padding:10px 18px; margin:16px 0; border:1px solid #ddd; background:white; cursor:pointer; } @media print { button { display:none; } }`
  doc.head.appendChild(style)
  const add = (parent: HTMLElement, tag: string, value: string, className?: string) => {
    const element = doc.createElement(tag)
    element.textContent = value
    if (className) element.className = className
    parent.appendChild(element)
    return element
  }
  const button = add(doc.body, 'button', 'Print / Save as PDF · પ્રિન્ટ / PDF સાચવો')
  button.onclick = () => preview.print()
  parts.forEach(part => {
    const section = add(doc.body, 'section', '')
    add(section, 'h1', `ShreeRam Milks — ${part.riderName || 'Rider sheet'}`)
    add(section, 'p', `${sheet.date} · ${sheet.slot.name} · ${sheet.slot.startTime}–${sheet.slot.endTime} · ${sheet.status === 'final' ? 'Final' : 'Draft — may change'}`)
    add(section, 'p', `LOAD / લોડ: ${part.load.map(item => `${item.quantity} × ${item.productName} ${item.variantName}`).join(' · ')}`, 'load')
    let number = 1
    for (const area of part.areas) {
      add(section, 'h2', `PIN ${area.pinCode} · ${area.city} · ${area.stops.length} deliveries`)
      add(section, 'p', area.load.map(item => `${item.quantity} × ${item.productName} ${item.variantName}`).join(' · '))
      const table = add(section, 'table', '')
      table.style.tableLayout = 'fixed'
      const columns = add(table, 'colgroup', '')
      for (const width of ['5%', '16%', '44%', '28%', '7%']) {
        const column = add(columns, 'col', '')
        column.style.width = width
      }
      const header = add(table, 'thead', '')
      const headerRow = add(header, 'tr', '')
      for (const label of ['#', 'Customer / ગ્રાહક', 'Address / સરનામું', 'Give / આપવાનું', 'Done / થઈ ગયું']) add(headerRow, 'th', label)
      const body = add(table, 'tbody', '')
      const addStop = (stop: RiderStop) => {
        const row = add(body, 'tr', '')
        add(row, 'td', String(number++))
        const customer = add(row, 'td', stop.recipientName)
        add(customer, 'small', stop.recipientPhone)
        if (stop.kind === 'trial') add(customer, 'small', 'Trial')
        if (!stop.deliveryDetailsConfirmed) add(customer, 'small', 'Details need confirmation / વિગતોની ખાતરી બાકી')
        add(row, 'td', riderStopAddress(stop))
        add(row, 'td', riderLoadText(stop.items))
        add(row, 'td', '☐')
      }
      const addSection = (section: RiderSection) => {
        if (section.label) {
          const row = add(body, 'tr', '', 'group')
          const cell = add(row, 'td', `${section.label} · ${section.stops.length} deliveries`) as HTMLTableCellElement
          cell.colSpan = 3
          add(row, 'td', riderLoadText(section.load))
          add(row, 'td', '')
        }
        if (section.children.length) section.children.forEach(addSection)
        else section.stops.forEach(addStop)
      }
      riderDeliverySections(area.stops).forEach(addSection)
    }
  })
  void (async () => {
    // Layout requests the Gujarati face before fonts.ready resolves.
    void doc.body.offsetHeight
    await doc.fonts.ready
    if (!preview.closed) { preview.focus(); preview.print() }
  })()
}
