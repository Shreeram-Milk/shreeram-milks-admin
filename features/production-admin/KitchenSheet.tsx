import { formatTime12h, formatTimestamp, formatWeekdayDate } from '@/lib/business-time'
import { describeTotals, sumTotals, type PlannedSlot } from './api'
import { t } from './messages'

/**
 * The printed sheet for the production floor: per delivery window, each product size with its piece count in large numbers and
 * a box to tick when it is made. Only shows when printing. An open window prints as a draft, because its numbers can change.
 */
export function KitchenSheet({ date, slots }: { date: string; slots: PlannedSlot[] }) {
  return <section className="kitchen-sheet print-only" aria-hidden="true">
    {slots.map(slot => <article className="kitchen-window" key={slot.slotId}>
      <header className="kitchen-head">
        <div>
          <h2>{slot.slotName} · {formatTime12h(slot.startTime)}–{formatTime12h(slot.endTime)}</h2>
          <p>{formatWeekdayDate(date)} · {t(slot.orderCount === 1 ? 'kitchenDeliveryOne' : 'kitchenDeliveryMany', { count: slot.orderCount })}</p>
        </div>
        <p className={`rider-sheet-state${slot.status === 'final' ? ' is-final' : ''}`}>{slot.status === 'final' ? t('kitchenFinal') : t('kitchenDraft', { until: slot.closesAt ? t('until', { time: formatTimestamp(slot.closesAt) }) : '' })}</p>
      </header>
      <table className="kitchen-table">
        <thead><tr><th>{t('product')}</th><th>{t('size')}</th><th className="num">{t('make')}</th><th className="num">{t('amount')}</th><th className="kitchen-done">{t('done')}</th></tr></thead>
        <tbody>{slot.products.flatMap(product => product.variants.map(variant => <tr key={`${product.productId}|${variant.variantId}`}>
          <td>{product.productName}</td>
          <td>{variant.variantName}</td>
          <td className="num kitchen-count">{variant.quantity}</td>
          <td className="num">{variant.production ? `${variant.production.quantity} ${variant.production.unit}` : '—'}</td>
          <td className="kitchen-done"><span className="rider-box">✓</span></td>
        </tr>))}</tbody>
      </table>
      <p className="kitchen-total">{t('totalToPrepare')} <strong>{describeTotals(sumTotals(slot.products.map(product => product.production)), slot.quantity)}</strong></p>
      <p className="kitchen-sign">{t('madeBy')} ____________________ &nbsp;&nbsp; {t('checkedBy')} ____________________</p>
    </article>)}
  </section>
}
