import type { RiderStop, RiderSheet } from '../production-admin/api'
import type { RiderPart } from './rider-sheet-pdf'
import { riderDeliverySections, riderStopAddress, type RiderSection } from './rider-stop-groups'

/** Browser shaping keeps Gujarati and every original Unicode address intact. The print dialog offers Save as PDF. */
export async function printUnicodeRiderSheet(sheet: RiderSheet, parts: RiderPart[], fileName: string): Promise<void> {
  const preview = window.open('', '_blank')
  if (!preview) throw new Error('Allow the print preview window, then try again.')
  preview.opener = null
  const doc = preview.document
  doc.title = fileName.replace(/\.pdf$/i, '')
  doc.documentElement.lang = 'gu'
  doc.documentElement.className = document.documentElement.className
  doc.body.className = document.body.className
  // Define font faces in the print document itself: reusing CSS-connected faces from
  // the opener can paint correctly on screen while dropping bold names in a saved PDF.
  const regularFont = new URL('/fonts/pdf/NotoSansGujarati-Regular.ttf', window.location.href).href
  const boldFont = new URL('/fonts/pdf/NotoSansGujarati-Bold.ttf', window.location.href).href
  const style = doc.createElement('style')
  style.textContent = `
    @font-face { font-family:ShreeRamRider; src:url("${regularFont}") format("truetype"); font-weight:400; font-style:normal; }
    @font-face { font-family:ShreeRamRider; src:url("${boldFont}") format("truetype"); font-weight:700; font-style:normal; }
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    html,body { height:auto!important; overflow:visible!important; background:white!important; color:#14243b!important; }
    body { margin:0; font-family:ShreeRamRider,Arial,sans-serif; font-size:11.5px; line-height:1.65; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .sheet-header { border:1px solid #dbe5f3; border-top:5px solid #245baf; border-radius:12px; padding:15px 17px; margin:0 0 14px; }
    .brand { color:#245baf; font-size:10px; font-weight:700; letter-spacing:.8px; margin:0 0 4px; }
    h1 { font-size:21px; line-height:1.4; margin:0 0 5px; }
    h2 { font-size:15px; margin:18px 0 4px; color:#1c477f; }
    p { margin:4px 0 10px; }
    section+section { break-before:page; }
    table { border-collapse:separate; border-spacing:0; width:100%; min-width:0!important; margin:10px 0 18px; border:1px solid #dbe3ee; border-radius:9px; overflow:hidden; }
    th,td { white-space:normal!important; padding:8px; font-size:11.5px; vertical-align:top; overflow-wrap:anywhere; border-bottom:1px solid #e4eaf2; }
    th { background:#f2f6fc; color:#48617e; text-align:left; font-size:10px; font-weight:700; }
    thead { display:table-header-group; } tr { break-inside:avoid; }
    .group td { background:#edf4ff; font-size:10.5px; font-weight:700; color:#244d86; padding:6px 8px; }
    .group { break-after:avoid; } .group-building td,.group-floor td { background:#f7f9fc; color:#4a5f78; }
    .customer { font-size:13px; font-weight:700; color:#14243b; }
    .address { line-height:1.7; color:#1d304b; }
    tbody.delivery-stop { break-inside:avoid; }
    .product { color:#163c72; font-weight:700; }
    .size { font-weight:700; text-align:center; }
    .quantity { font-size:17px; line-height:1.4; font-weight:700; text-align:center; color:#163c72; }
    .stop-number { padding-left:4px; padding-right:4px; white-space:nowrap!important; }
    .load-table { margin:8px 0 16px; }
    .done { text-align:center; font-size:17px; color:#5e728b; }
    .load { border:1px solid #dae5f4; border-radius:9px; background:#f5f8fe; padding:11px 13px; font-weight:700; }
    .check { color:#9c5b12; font-weight:400; font-size:9px; margin-top:4px; }
    .note { color:#60738b; font-size:10px; margin:4px 0 12px; }
    small { display:block; color:#60738b; font-size:10px; font-weight:400; }
    button { padding:10px 18px; margin:16px 0; border:1px solid #b9cae0; border-radius:8px; background:white; cursor:pointer; }
    @media print { button { display:none; } }
  `
  doc.head.appendChild(style)
  const add = (parent: HTMLElement, tag: string, value: string, className?: string) => {
    const element = doc.createElement(tag)
    element.textContent = value
    if (className) element.className = className
    parent.appendChild(element)
    return element
  }
  const button = add(doc.body, 'button', 'Print / Save as PDF · પ્રિન્ટ / PDF સાચવો')
  button.setAttribute('disabled', '')
  button.onclick = () => { if (doc.documentElement.dataset.printReady === 'true') preview.print() }
  parts.forEach(part => {
    const section = add(doc.body, 'section', '')
    const heading = add(section, 'header', '', 'sheet-header')
    add(heading, 'div', 'SHREERAM MILKS', 'brand')
    add(heading, 'h1', part.riderName || 'Rider sheet / ડિલિવરી યાદી')
    add(heading, 'p', `${sheet.date} · ${sheet.slot.name} · ${sheet.slot.startTime}–${sheet.slot.endTime} · ${sheet.status === 'final' ? 'Final' : 'Draft — may change'}`)
    add(section, 'p', 'સાથે લેવાનું / Total load', 'load')
    const loadTable = add(section, 'table', '', 'load-table')
    const loadHead = add(add(loadTable, 'thead', ''), 'tr', '')
    for (const label of ['Product / વસ્તુ', 'Size / માપ', 'Qty / નંગ']) add(loadHead, 'th', label)
    const loadBody = add(loadTable, 'tbody', '')
    for (const item of part.load) {
      const row = add(loadBody, 'tr', '')
      add(row, 'td', item.productName, 'product')
      add(row, 'td', item.variantName || '-', 'size')
      add(row, 'td', String(item.quantity), 'quantity')
    }
    let number = 1
    for (const area of part.areas) {
      add(section, 'h2', `PIN ${area.pinCode} · ${area.city} · ${area.stops.length} deliveries`)
      const table = add(section, 'table', '')
      table.style.tableLayout = 'fixed'
      const columns = add(table, 'colgroup', '')
      for (const width of ['4%', '18%', '32%', '20%', '11%', '8%', '7%']) {
        const column = add(columns, 'col', '')
        column.style.width = width
      }
      const header = add(table, 'thead', '')
      const headerRow = add(header, 'tr', '')
      for (const label of ['#', 'Customer / ગ્રાહક', 'Address / સરનામું', 'Product / વસ્તુ', 'Size / માપ', 'Qty / નંગ', 'Done / થયું']) add(headerRow, 'th', label)
      const addStop = (stop: RiderStop) => {
        const body = add(table, 'tbody', '', 'delivery-stop')
        const row = add(body, 'tr', '')
        row.dataset.orderId = stop.orderId
        const span = Math.max(1, stop.items.length)
        const numberCell = add(row, 'td', String(number++), 'stop-number') as HTMLTableCellElement
        numberCell.rowSpan = span
        const customer = add(row, 'td', stop.recipientName, 'customer')
        ;(customer as HTMLTableCellElement).rowSpan = span
        add(customer, 'small', stop.recipientPhone)
        if (stop.kind === 'trial') add(customer, 'small', 'Trial')
        if (!stop.deliveryDetailsConfirmed) add(customer, 'small', 'Details not confirmed / વિગતોની ખાતરી બાકી', 'check')
        const address = add(row, 'td', riderStopAddress(stop), 'address') as HTMLTableCellElement
        address.rowSpan = span
        stop.items.forEach((item, index) => {
          const productRow = index === 0 ? row : add(body, 'tr', '')
          productRow.dataset.productOrderId = stop.orderId
          add(productRow, 'td', item.productName, 'product')
          add(productRow, 'td', item.variantName || '-', 'size')
          add(productRow, 'td', String(item.quantity), 'quantity')
        })
        if (!stop.items.length) {
          for (let index = 0; index < 3; index++) add(row, 'td', '-')
        }
        const done = add(row, 'td', '☐', 'done') as HTMLTableCellElement
        done.rowSpan = span
      }
      const addSection = (section: RiderSection) => {
        if (section.label) {
          const body = add(table, 'tbody', '')
          const row = add(body, 'tr', '', `group group-${section.level}`)
          const cell = add(row, 'td', `${section.label} · ${section.stops.length} deliveries`) as HTMLTableCellElement
          cell.colSpan = 7
        }
        if (section.children.length) section.children.forEach(addSection)
        else section.stops.forEach(addStop)
      }
      riderDeliverySections(area.stops).forEach(addSection)
    }
    add(section, 'p', 'Tick after delivery. If the address is unclear, call the customer. / ડિલિવરી પછી નિશાન કરો. સરનામું ન સમજાય તો ગ્રાહકને ફોન કરો.', 'note')
  })
  {
    // Layout requests the Gujarati face before fonts.ready resolves.
    void doc.body.offsetHeight
    const family = 'ShreeRamRider'
    // A newly opened window may reach fonts.ready before it has requested every bold face.
    // Explicitly load both weights with the full sheet text before printing (names and totals use bold).
    const sample = doc.body.textContent || 'Delivery'
    await Promise.all([doc.fonts.load(`400 12px ${family}`, sample), doc.fonts.load(`700 13px ${family}`, sample)])
    await doc.fonts.ready
    await new Promise<void>(resolve => preview.requestAnimationFrame(() => preview.requestAnimationFrame(() => resolve())))
    doc.documentElement.dataset.printReady = 'true'
    button.removeAttribute('disabled')
    if (!preview.closed) { preview.focus(); preview.print() }
  }
}
