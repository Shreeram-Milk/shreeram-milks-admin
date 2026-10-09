import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Repeat, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { formatINR } from '@/lib/money'
import type { DashboardSummary } from './service'

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

/** Four numbers, read left to right: today's work, tomorrow's work, the recurring base, the money owed. */
export function KpiRow({ summary }: { summary: DashboardSummary }) {
  const { deliveriesToday: day, subscriptions, credit } = summary
  return <div className="kpi-row" aria-label="Key figures">
    <KpiCard icon={Truck} label="Left to deliver today" value={day.remaining} detail={`${day.delivered} of ${day.planned} delivered`} href={`/deliveries?date=${summary.today}&status=scheduled`} />
    <KpiCard icon={CalendarClock} label="Planned for tomorrow" value={summary.plannedTomorrow} detail="Scheduled deliveries" href={`/production-planning?date=${summary.tomorrow}`} />
    <KpiCard icon={Repeat} label="Active subscriptions" value={subscriptions.active} detail={`${subscriptions.paused} paused`} href="/subscriptions" />
    <KpiCard icon={Wallet} label="Credit receivable" value={formatINR(credit.totalReceivablePaise)} detail={`${credit.outstandingAccounts} outstanding ${credit.outstandingAccounts === 1 ? 'account' : 'accounts'}`} href="/credit-accounts" />
  </div>
}

/** One line that answers "is anything wrong?" before the admin reads anything else. */
export function StatusBanner({ issueTotal }: { issueTotal: number }) {
  if (issueTotal === 0) return <div className="status-banner" data-tone="good" role="status"><CheckCircle2 size={18} aria-hidden="true" /><p><strong>All clear.</strong> No operational issues right now.</p></div>
  return <div className="status-banner" data-tone="warn" role="status"><AlertTriangle size={18} aria-hidden="true" /><p><strong>{issueTotal} {issueTotal === 1 ? 'issue needs' : 'issues need'} attention.</strong> Fix before they affect deliveries.</p><a href="#dashboard-issues">Review</a></div>
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
