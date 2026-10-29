import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Repeat, RotateCcw, Smartphone, Truck, Users, Wallet, type LucideIcon } from 'lucide-react'
import { formatINR } from '@/lib/money'
import type { DashboardData } from './api'
import { plural, t } from './messages'

/** Every KPI card has the same anatomy: icon, label, one big value, one line of context. The whole card is the link. */
function KpiCard({ icon: Icon, label, value, detail, href }: { icon: LucideIcon; label: string; value: string | number; detail: string; href: string }) {
  return <Link className="kpi-card" href={href}>
    <span className="kpi-icon" aria-hidden="true"><Icon size={18} /></span>
    <span className="kpi-label">{label}</span>
    <span className="kpi-value">{value}</span>
    <span className="kpi-detail">{detail}</span>
    <ArrowUpRight className="kpi-arrow" size={16} aria-hidden="true" />
  </Link>
}

/** Two rows of numbers: the day's work first, then the money. */
export function KpiRows({ data }: { data: DashboardData }) {
  const { deliveries, plans, money, customers } = data
  const left = deliveries.today.placed + deliveries.today.out_for_delivery
  return <>
    <div className="kpi-row" aria-label={t('todayTomorrow')}>
      <KpiCard icon={Truck} label={t('leftToday')} value={left} detail={t('deliveredOf', { done: deliveries.today.delivered, total: deliveries.todayTotal })} href="/orders" />
      <KpiCard icon={CalendarClock} label={t('comingTomorrow')} value={deliveries.tomorrowTotal} detail={t('ordersToDeliver')} href="/production-planning" />
      <KpiCard icon={Repeat} label={t('runningSubscriptions')} value={plans.subscriptions} detail={plural(plans.trials, 'trialsRunningOne', 'trialsRunningMany')} href="/subscriptions" />
      <KpiCard icon={Users} label={t('customers')} value={customers.active} detail={t('newThisWeek', { count: customers.newThisWeek })} href="/customers" />
    </div>
    <div className="kpi-row" aria-label={t('money')}>
      <KpiCard icon={Wallet} label={t('owedByCredit')} value={formatINR(money.owedPaise)} detail={plural(money.owingCustomers, 'customerOwesOne', 'customerOwesMany')} href="/credit-accounts" />
      <KpiCard icon={Smartphone} label={t('paidOnlineToday')} value={formatINR(money.paidOnlineTodayPaise)} detail={t('throughPhonePe')} href="/online-payments" />
      <KpiCard icon={RotateCcw} label={t('refundsToSend')} value={money.refundsToSend} detail={formatINR(money.refundsToSendPaise)} href="/prepaid-adjustments" />
    </div>
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
