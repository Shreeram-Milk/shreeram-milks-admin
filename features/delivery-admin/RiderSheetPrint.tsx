import { formatTime12h, formatTimestamp, formatWeekdayDate } from '@/lib/business-time'
import type { RiderArea, RiderItem, RiderSheet } from '../production-admin/api'
import { t } from './messages'

/** "Cow Milk 500 ml × 2" lines, one per product size. */
function LoadList({ items }: { items: RiderItem[] }) {
  return <ul className="rider-load-list">{items.map(item => <li key={`${item.productId}|${item.variantId}`}>{item.productName} {item.variantName} <strong>× {item.quantity}</strong></li>)}</ul>
}

/**
 * One rider's printed sheet: the window and day, what to load, then each PIN code with its houses in visiting order. Houses are
 * numbered across the whole sheet so the rider can say "number 23". A window that is still open prints as a draft.
 */
export function RiderSheetPrint({ sheet, riderName, areas, load, hidden }: { sheet: RiderSheet; riderName: string; areas: RiderArea[]; load: RiderItem[]; hidden: boolean }) {
  const houses = areas.reduce((sum, area) => sum + area.stops.length, 0)
  // Where each area's numbering starts: houses are numbered across the whole sheet.
  const firstNumber = areas.map((_, index) => areas.slice(0, index).reduce((sum, area) => sum + area.stops.length, 0) + 1)
  return <article className={`rider-sheet${hidden ? ' print-skip' : ''}`} aria-label={riderName ? t('sheetFor', { name: riderName }) : t('riderSheet')}>
    <header className="rider-sheet-head">
      <div>
        <h2>{riderName ? `${riderName} · ` : ''}{sheet.slot.name} {formatTime12h(sheet.slot.startTime)}–{formatTime12h(sheet.slot.endTime)}</h2>
        <p>{formatWeekdayDate(sheet.date)} · {t(areas.length === 1 ? 'areaOne' : 'areaMany', { count: areas.length })} · {t(houses === 1 ? 'houseOne' : 'houseMany', { count: houses })}</p>
      </div>
      <p className={`rider-sheet-state${sheet.status === 'final' ? ' is-final' : ''}`}>
        {sheet.status === 'final' ? t('final') : t('draft', { until: sheet.closesAt ? t('until', { time: formatTimestamp(sheet.closesAt) }) : '' })}
      </p>
    </header>
    <section className="rider-load"><strong>{t('loadVehicle')}</strong><LoadList items={load} /></section>
    {areas.map((area, areaIndex) => <section className="rider-area" key={area.pinCode}>
      <div className="rider-area-head"><strong>{t('pin', { pin: area.pinCode })}{area.city ? ` · ${area.city}` : ''}</strong><span>{t(area.stops.length === 1 ? 'houseOne' : 'houseMany', { count: area.stops.length })}</span></div>
      <div className="rider-area-load"><LoadList items={area.load} /></div>
      <table className="rider-table">
        <thead><tr><th className="rider-col-number">#</th><th>{t('nameAndPhone')}</th><th>{t('addressAndNote')}</th><th>{t('give')}</th><th className="rider-col-done">{t('done')}</th></tr></thead>
        <tbody>{area.stops.map((stop, stopIndex) => {
          return <tr key={stop.orderId}>
            <td className="rider-col-number">{(firstNumber[areaIndex] ?? 1) + stopIndex}</td>
            <td>{stop.recipientName}{stop.kind === 'trial' ? <span className="rider-kind">{t('trial')}</span> : null}<br /><span className="rider-muted">{stop.recipientPhone}</span></td>
            <td>{[stop.addressLine1, stop.addressLine2, stop.landmark].filter(Boolean).join(', ')}{stop.doorstepNote ? <><br /><span className="rider-note">{stop.doorstepNote}</span></> : null}</td>
            <td className="rider-give">{stop.items.map(item => <div key={`${item.productId}|${item.variantId}`}>{item.productName} {item.variantName} × {item.quantity}</div>)}</td>
            <td className="rider-col-done"><span className="rider-box" aria-hidden="true">✓</span> <span className="rider-box" aria-hidden="true">✗</span></td>
          </tr>
        })}</tbody>
      </table>
    </section>)}
    <footer className="rider-sheet-foot">{t('sheetFoot')}</footer>
  </article>
}
