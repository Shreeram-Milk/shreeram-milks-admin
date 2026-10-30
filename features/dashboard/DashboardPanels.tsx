import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateTime, formatTime12h } from '@/lib/business-time'
import { dashboardINR } from './money'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, type OrderStatus } from '../order-admin/api'
import { Panel } from './DashboardCards'
import { SalesChart } from './SalesChart'
import type { DashboardData } from './api'
import type { AttentionItem } from './attention'
import { plural, t } from './messages'

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))
const isOrderStatus = (value: string): value is OrderStatus => value in ORDER_STATUS_LABELS

/** Sales per day for two weeks, with the week's total above the bars. */
export function SalesPanel({ data }: { data: DashboardData }) {
  const { trend, last7Paise, last7Orders } = data.sales
  const hasSales = trend.some(day => day.orders > 0)
  return <Panel id="sales" title={t('salesTitle')} subtitle={t('salesSubtitle', { amount: dashboardINR(last7Paise), orders: plural(last7Orders, 'ordersOne', 'ordersMany') })} href="/orders" linkLabel={t('openOrders')}>
    {hasSales ? <SalesChart days={trend} /> : <p className="panel-empty">{t('noSalesYet')}</p>}
  </Panel>
}

/** How each delivery window is going today: delivered out of the day's orders for that window. */
export function WindowsPanel({ data }: { data: DashboardData }) {
  const { windows } = data
  return <Panel id="windows" title={t('todayByWindow')} subtitle={t('todayByWindowSubtitle')} href="/deliveries" linkLabel={t('openDeliveries')}>
    {windows.length === 0 ? <p className="panel-empty">{t('noDeliveriesToday')}</p> : <ul className="window-list">{windows.map(window => {
      const value = percent(window.delivered, window.total)
      return <li key={window.slotId}>
        <div className="window-head"><strong>{window.name}</strong><span>{formatTime12h(window.startTime)} – {formatTime12h(window.endTime)}</span><b>{t('deliveredOf', { done: window.delivered, total: window.total })}</b></div>
        <div className="progress-track" role="progressbar" aria-label={window.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className="progress-fill" style={{ width: `${value}%` }} /></div>
        <p className="window-detail">{t('onTheWay', { count: window.outForDelivery })}{window.missed > 0 ? ` · ${t('missedCount', { count: window.missed })}` : ''}</p>
      </li>
    })}</ul>}
  </Panel>
}

/** The five products that earned the most in the last 7 days, each with a bar relative to the best seller. */
export function TopProductsPanel({ data }: { data: DashboardData }) {
  const { topProducts } = data
  const best = Math.max(...topProducts.map(product => product.revenuePaise), 1)
  return <Panel id="top-products" title={t('topProducts')} subtitle={t('last7Days')} href="/products" linkLabel={t('openProducts')}>
    {topProducts.length === 0 ? <p className="panel-empty">{t('noSalesYet')}</p> : <ol className="top-list">{topProducts.map(product => <li key={product.name}>
      <div className="top-head"><strong>{product.name}</strong><span>{dashboardINR(product.revenuePaise)}</span></div>
      <div className="top-bar"><span style={{ width: `${percent(product.revenuePaise, best)}%` }} /></div>
      <p>{t('unitsSold', { count: product.quantity })}</p>
    </li>)}</ol>}
  </Panel>
}

/** The latest orders, newest first, so a new order is visible without opening the list. */
export function RecentOrdersPanel({ data }: { data: DashboardData }) {
  const { recentOrders } = data
  return <Panel id="recent-orders" title={t('recentOrders')} href="/orders" linkLabel={t('openOrders')}>
    {recentOrders.length === 0 ? <p className="panel-empty">{t('noOrdersYet')}</p> : <div className="recent-table-wrap"><table className="recent-table">
      <thead><tr><th>{t('orderColumn')}</th><th>{t('customerColumn')}</th><th>{t('placedColumn')}</th><th className="num">{t('totalColumn')}</th><th>{t('statusColumn')}</th></tr></thead>
      <tbody>{recentOrders.map(order => <tr key={order.id}>
        <td><Link className="product-name-link" href="/orders">{order.orderNumber}</Link></td>
        <td>{order.customerName || '—'}</td>
        <td>{formatDateTime(order.placedAt)}</td>
        <td className="num">{dashboardINR(order.totalPaise)}</td>
        <td>{isOrderStatus(order.status) ? <StatusBadge status={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge> : order.status}</td>
      </tr>)}</tbody>
    </table></div>}
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
