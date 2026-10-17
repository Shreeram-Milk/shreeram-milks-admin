import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Repeat, RotateCcw, Smartphone, Truck, Users, Wallet, type LucideIcon } from 'lucide-react'
import { formatINR } from '@/lib/money'
import type { DashboardData } from './api'

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
    <div className="kpi-row" aria-label="Today and tomorrow">
      <KpiCard icon={Truck} label="Left to deliver today" value={left} detail={`${deliveries.today.delivered} of ${deliveries.todayTotal} delivered`} href="/orders" />
      <KpiCard icon={CalendarClock} label="Coming tomorrow" value={deliveries.tomorrowTotal} detail="Orders to deliver" href="/production-planning" />
      <KpiCard icon={Repeat} label="Running subscriptions" value={plans.subscriptions} detail={`${plans.trials} ${plans.trials === 1 ? 'trial' : 'trials'} running`} href="/subscriptions" />
      <KpiCard icon={Users} label="Customers" value={customers.active} detail={`${customers.newThisWeek} new in the last 7 days`} href="/customers" />
    </div>
    <div className="kpi-row" aria-label="Money">
      <KpiCard icon={Wallet} label="Owed by credit customers" value={formatINR(money.owedPaise)} detail={`${money.owingCustomers} ${money.owingCustomers === 1 ? 'customer owes' : 'customers owe'} money`} href="/credit-accounts" />
      <KpiCard icon={Smartphone} label="Paid online today" value={formatINR(money.paidOnlineTodayPaise)} detail="Through PhonePe" href="/online-payments" />
      <KpiCard icon={RotateCcw} label="Refunds to send" value={money.refundsToSend} detail={formatINR(money.refundsToSendPaise)} href="/prepaid-adjustments" />
    </div>
  </>
}

/** One line that answers "is anything wrong?" before the admin reads anything else. */
export function StatusBanner({ issueTotal }: { issueTotal: number }) {
  if (issueTotal === 0) return <div className="status-banner" data-tone="good" role="status"><CheckCircle2 size={18} aria-hidden="true" /><p><strong>All clear.</strong> Nothing needs your attention right now.</p></div>
  return <div className="status-banner" data-tone="warn" role="status"><AlertTriangle size={18} aria-hidden="true" /><p><strong>{issueTotal} {issueTotal === 1 ? 'thing needs' : 'things need'} your attention.</strong></p><a href="#dashboard-issues">Review</a></div>
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
