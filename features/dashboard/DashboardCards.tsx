import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, IndianRupee, Minus, PackageCheck, Repeat, ShoppingBag, ThumbsUp, Truck, UserPlus, Wallet, type LucideIcon } from 'lucide-react'
import { dashboardINR } from './money'
import type { DashboardData } from './api'
import { plural, t } from './messages'

/** "+12%" / "-8%" against the previous period; null when there was nothing before to compare with. */
function change(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (previous === 0) return current > 0 ? { text: t('newLabel'), tone: 'up' } : null
  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent === 0) return { text: '0%', tone: 'flat' }
  return { text: `${percent > 0 ? '+' : ''}${percent}%`, tone: percent > 0 ? 'up' : 'down' }
}

function Delta({ current, previous, versus }: { current: number; previous: number; versus: string }) {
  const result = change(current, previous)
  if (!result) return <span className="kpi-versus">{versus}</span>
  const Icon = result.tone === 'up' ? ArrowUpRight : result.tone === 'down' ? ArrowDownRight : Minus
  return <span className="kpi-delta-row"><span className="kpi-delta" data-tone={result.tone}><Icon size={13} aria-hidden="true" />{result.text}</span><span className="kpi-versus">{versus}</span></span>
}

/** Every KPI card has the same anatomy: label and icon on top, one big value, then a change against the last period or one line of context. The whole card is the link. */
function KpiCard({ icon: Icon, label, value, href, children }: { icon: LucideIcon; label: string; value: string | number; href: string; children: ReactNode }) {
  return <Link className="kpi-card" href={href}>
    <span className="kpi-top"><span className="kpi-label">{label}</span><span className="kpi-icon" aria-hidden="true"><Icon size={16} /></span></span>
    <span className="kpi-value">{value}</span>
    <span className="kpi-foot">{children}</span>
  </Link>
}

/** Two rows of four: how the business is selling first, then how it is running. */
export function KpiRows({ data }: { data: DashboardData }) {
  const { deliveries, plans, money, customers, sales, deliveryQuality } = data
  const left = deliveries.today.placed + deliveries.today.out_for_delivery
  const finished = deliveryQuality.delivered7 + deliveryQuality.missed7
  const success = finished === 0 ? null : Math.round((deliveryQuality.delivered7 / finished) * 100)
  const averageOrder = sales.last7Orders === 0 ? 0 : Math.round(sales.last7Paise / sales.last7Orders)
  return <>
    <div className="kpi-row" aria-label={t('sellingRow')}>
      <KpiCard icon={IndianRupee} label={t('salesToday')} value={dashboardINR(sales.todayPaise)} href="/orders"><Delta current={sales.todayPaise} previous={sales.yesterdayPaise} versus={t('vsYesterday')} /></KpiCard>
      <KpiCard icon={ShoppingBag} label={t('ordersToday')} value={sales.todayOrders} href="/orders"><Delta current={sales.todayOrders} previous={sales.yesterdayOrders} versus={t('vsYesterday')} /></KpiCard>
      <KpiCard icon={IndianRupee} label={t('sales7')} value={dashboardINR(sales.last7Paise)} href="/orders"><Delta current={sales.last7Paise} previous={sales.previous7Paise} versus={t('vsPrevious7')} /></KpiCard>
      <KpiCard icon={UserPlus} label={t('newCustomers')} value={customers.newThisWeek} href="/customers"><Delta current={customers.newThisWeek} previous={customers.newPreviousWeek} versus={t('vsPrevious7')} /></KpiCard>
    </div>
    <div className="kpi-row" aria-label={t('runningRow')}>
      <KpiCard icon={Truck} label={t('leftToday')} value={left} href="/orders"><span className="kpi-versus">{t('deliveredOf', { done: deliveries.today.delivered, total: deliveries.todayTotal })}</span></KpiCard>
      <KpiCard icon={ThumbsUp} label={t('deliverySuccess')} value={success === null ? '—' : `${success}%`} href="/orders"><span className="kpi-versus">{success === null ? t('noFinishedYet') : t('missedLast7', { count: deliveryQuality.missed7 })}</span></KpiCard>
      <KpiCard icon={Repeat} label={t('runningSubscriptions')} value={plans.subscriptions} href="/subscriptions"><span className="kpi-versus">{plural(plans.trials, 'trialsRunningOne', 'trialsRunningMany')}</span></KpiCard>
      <KpiCard icon={Wallet} label={t('owedByCredit')} value={dashboardINR(money.owedPaise)} href="/credit-accounts"><span className="kpi-versus">{plural(money.owingCustomers, 'customerOwesOne', 'customerOwesMany')}</span></KpiCard>
    </div>
    <p className="kpi-note"><PackageCheck size={14} aria-hidden="true" /> {t('tomorrowNote', { count: deliveries.tomorrowTotal })} · {t('averageOrder', { amount: dashboardINR(averageOrder) })}</p>
  </>
}

/** One line that answers "is anything wrong?" before the admin reads anything else. */
export function StatusBanner({ issueTotal }: { issueTotal: number }) {
  if (issueTotal === 0) return <div className="status-banner" data-tone="good" role="status"><CheckCircle2 size={18} aria-hidden="true" /><p><strong>{t('allClear')}</strong> {t('nothingNeeded')}</p></div>
  return <div className="status-banner" data-tone="warn" role="status"><AlertTriangle size={18} aria-hidden="true" /><p><strong>{plural(issueTotal, 'thingNeedsOne', 'thingNeedsMany')}</strong></p><a href="#dashboard-issues">{t('review')}</a></div>
}

/** Every panel has the same anatomy: a title row (with an optional link) above its content. */
export function Panel({ id, title, subtitle, href, linkLabel, children }: { id: string; title: string; subtitle?: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return <section className="panel" aria-labelledby={`${id}-title`}>
    <header className="panel-header">
      <div><h2 id={`${id}-title`}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {href && linkLabel && <Link className="panel-link" href={href}>{linkLabel} →</Link>}
    </header>
    <div className="panel-body">{children}</div>
  </section>
}
