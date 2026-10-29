import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Panel } from './DashboardCards'
import type { DashboardData } from './api'
import type { AttentionItem } from './attention'
import { plural, t } from './messages'

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

/** How today is going: the share delivered, then how many orders are in each state. Cancelled orders are not counted as work. */
export function TodayPanel({ data }: { data: DashboardData }) {
  const { today, todayTotal } = data.deliveries
  const value = percent(today.delivered, todayTotal)
  return <Panel id="today-deliveries" title={t('todayDeliveries')} subtitle={t('todayDeliveriesSubtitle')} href="/orders" linkLabel={t('openOrders')}>
    {todayTotal === 0 ? <p className="panel-empty">{t('noDeliveriesToday')}</p> : <div className="day-hero">
      <p className="day-hero-figure"><strong>{value}%</strong><span>{t('deliveredOf', { done: today.delivered, total: todayTotal })}</span></p>
      <div className="progress"><div className="progress-track" role="progressbar" aria-label={t('deliveryProgress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className="progress-fill" style={{ width: `${value}%` }} /></div></div>
      <ul className="day-legend">
        <li data-kind="left">{t('placed')} <strong>{today.placed}</strong></li>
        <li data-kind="left">{t('outForDelivery')} <strong>{today.out_for_delivery}</strong></li>
        <li data-kind="delivered">{t('delivered')} <strong>{today.delivered}</strong></li>
        {today.missed > 0 && <li data-kind="missed">{t('missed')} <strong>{today.missed}</strong></li>}
        {today.cancelled > 0 && <li>{t('cancelled')} <strong>{today.cancelled}</strong></li>}
      </ul>
    </div>}
  </Panel>
}

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return <div id="dashboard-issues"><Panel id="dash-issues" title={t('needsAttention')} subtitle={items.length === 0 ? undefined : plural(items.length, 'thingsToLookOne', 'thingsToLookMany')}>
    {items.length === 0
      ? <div className="panel-clear"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>{t('allClearShort')}</strong><p>{t('nothingNeeded')}</p></div></div>
      : <ul className="issue-list">{items.map(item => <li key={item.id}>
        <AlertTriangle size={16} aria-hidden="true" />
        <div><Link className="product-name-link" href={item.href}>{item.title}</Link><p>{item.detail}</p></div>
      </li>)}</ul>}
  </Panel></div>
}
