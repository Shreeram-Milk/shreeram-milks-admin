import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatProductionQuantity } from '../production-planning/quantity'
import { Panel } from './DashboardCards'
import type { DashboardIssue, DashboardSummary } from './service'

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100))

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const value = percent(done, total)
  return <div className="progress"><div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div className="progress-fill" style={{ width: `${value}%` }} /></div><span>{value}%</span></div>
}

/** Overall progress first (the answer), then one row per slot (the breakdown). */
export function TodayDeliveriesPanel({ summary }: { summary: DashboardSummary }) {
  const day = summary.deliveriesToday
  const missed = day.notDelivered + day.skipped
  return <Panel id="today-deliveries" title="Today’s deliveries" subtitle="Progress by delivery slot" href={`/deliveries?date=${summary.today}`} linkLabel="View all">
    {day.bySlot.length === 0 ? <p className="panel-empty">No deliveries are scheduled for today.</p> : <>
      <div className="day-hero">
        <p className="day-hero-figure"><strong>{percent(day.delivered, day.planned)}%</strong><span>{day.delivered} of {day.planned} delivered</span></p>
        <ProgressBar done={day.delivered} total={day.planned} label="Overall delivery progress" />
        <ul className="day-legend">
          <li data-kind="delivered">Delivered <strong>{day.delivered}</strong></li>
          <li data-kind="left">Left <strong>{day.remaining}</strong></li>
          {missed > 0 && <li data-kind="missed">Not delivered / skipped <strong>{day.notDelivered} / {day.skipped}</strong></li>}
        </ul>
      </div>
      <ul className="slot-list">{day.bySlot.map(slot => <li key={slot.slotId ?? 'none'}>
        <div><strong>{slot.slotName}</strong><span>{slot.delivered} of {slot.planned} delivered · {slot.remaining} left</span></div>
        <ProgressBar done={slot.delivered} total={slot.planned} label={`${slot.slotName} delivery progress`} />
      </li>)}</ul>
    </>}
  </Panel>
}

/** Grouped by slot so the kitchen reads it as a preparation list. */
export function TomorrowProductionPanel({ summary }: { summary: DashboardSummary }) {
  return <Panel id="tomorrow-production" title="Tomorrow’s production" subtitle="What to prepare for scheduled deliveries" href={`/production-planning?date=${summary.tomorrow}`} linkLabel="Production plan">
    {summary.tomorrowProduction.length === 0 ? <p className="panel-empty">No production-tracked deliveries are scheduled for tomorrow.</p>
      : <div className="prod-grid">{summary.tomorrowProduction.map(slot => <section key={slot.slotName} className="prod-slot" aria-label={`${slot.slotName} production`}>
        <h3>{slot.slotName}</h3>
        <ul>{slot.items.map(item => <li key={`${item.productName}|${item.unit}`}><span>{item.productName}</span><strong>{formatProductionQuantity(item.unit, item.requiredBase)}</strong></li>)}</ul>
      </section>)}</div>}
  </Panel>
}

const KIND_LABELS: Record<DashboardIssue['kind'], string> = { production: 'Production', serviceability: 'Serviceability', inactive_config: 'Inactive configuration', credit_posting: 'Credit posting', prepaid_posting: 'Prepaid adjustment', subscription: 'Subscription' }

export function IssuesPanel({ summary }: { summary: DashboardSummary }) {
  const hidden = summary.issueTotal - summary.issues.length
  return <div id="dashboard-issues"><Panel id="dash-issues" title="Needs attention" subtitle={summary.issueTotal === 0 ? undefined : `${summary.issueTotal} open ${summary.issueTotal === 1 ? 'issue' : 'issues'}`}>
    {summary.issues.length === 0
      ? <div className="panel-clear"><CheckCircle2 size={20} aria-hidden="true" /><div><strong>All clear</strong><p>No operational issues right now.</p></div></div>
      : <><ul className="issue-list">{summary.issues.map(issue => <li key={issue.id}>
        <AlertTriangle size={16} aria-hidden="true" />
        <div><span className="issue-kind">{KIND_LABELS[issue.kind]}</span><Link className="product-name-link" href={issue.href}>{issue.title}</Link><p>{issue.detail}</p></div>
      </li>)}</ul>{hidden > 0 && <p className="panel-note">+ {hidden} more {hidden === 1 ? 'issue' : 'issues'} not shown.</p>}</>}
  </Panel></div>
}
