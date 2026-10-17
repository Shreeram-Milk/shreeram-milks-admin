'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { addDays, formatDateTime, formatTime12h, todayInBusinessZone } from '@/lib/business-time'
import { DAY_LABELS, SKIP_REASON_LABELS, type DayLine, type DayLineState, type SubscriptionDetail } from './api'

type Filter = 'coming' | 'skipped' | 'paused' | 'done' | 'all'
export type DayRow = DayLine & { date: string }

const FIRST_DAYS = 10
const MORE_DAYS = 14
const ALL = '__all__'
const GROUP: Record<DayLineState, Exclude<Filter, 'all'>> = { upcoming: 'coming', placed: 'coming', out_for_delivery: 'coming', delivered: 'done', missed: 'done', skipped: 'skipped', paused: 'paused' }
const STATE_CLASS: Record<DayLineState, string> = { upcoming: 'coming', placed: 'coming', out_for_delivery: 'moving', delivered: 'done', missed: 'missed', skipped: 'skipped', paused: 'paused' }
const FILTER_LABELS: Record<Filter, string> = { coming: 'Coming', skipped: 'Skipped', paused: 'Paused', done: 'Delivered', all: 'All days' }

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' })
const DAY_MONTH = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const asUtc = (date: string) => new Date(`${date}T00:00:00Z`)

/** One line under a window: until when it can change, or why it will not come. */
function hint(line: DayRow): string {
  if (line.state === 'skipped') return line.skipReason ? SKIP_REASON_LABELS[line.skipReason] : 'Skipped'
  if (line.state === 'paused') return 'Paused: comes back when resumed'
  if (line.state === 'delivered' || line.state === 'missed') return ''
  if (line.canChange) return line.changeUntil ? `Can skip until ${formatDateTime(line.changeUntil)}` : 'Can still skip'
  return 'Locked: will be delivered'
}

/**
 * Every planned day of a subscription, newest last, split by what happened to it. A day that can still change has its
 * Skip (or Bring back) button right on the row.
 */
export function SubscriptionDayList({ subscription, busy, onChange }: { subscription: SubscriptionDetail; busy: boolean; onChange: (day: DayRow) => void }) {
  const [filter, setFilter] = useState<Filter>('coming')
  const [windowId, setWindowId] = useState('')
  const [shownDays, setShownDays] = useState(FIRST_DAYS)
  const today = todayInBusinessZone()
  const all: DayRow[] = subscription.days.flatMap(day => day.lines.map(line => ({ ...line, date: day.date })))
  const counts: Record<Filter, number> = { coming: 0, skipped: 0, paused: 0, done: 0, all: all.length }
  for (const line of all) counts[GROUP[line.state]] += 1
  const shown = all.filter(line => (filter === 'all' || GROUP[line.state] === filter) && (!windowId || line.lineId === windowId))
  const days = [...new Set(shown.map(line => line.date))]
  const visibleDays = days.slice(0, shownDays)
  const filters: Filter[] = ['coming', 'skipped', ...(counts.paused > 0 ? ['paused' as const] : []), 'done', 'all']

  return <section className="panel" aria-labelledby="sub-days-title">
    <header className="panel-header"><div><h2 id="sub-days-title">Delivery days</h2><p>Skip a day before its order-by time. A skipped day is added at the end, so nothing is lost.</p></div></header>
    <div className="panel-body">
      <div className="sub-days-toolbar">
        <div className="type-tabs" role="group" aria-label="Show days">
          {filters.map(item => <button key={item} type="button" className={`type-tab${filter === item ? ' is-active' : ''}`} aria-pressed={filter === item} onClick={() => { setFilter(item); setShownDays(FIRST_DAYS) }}><span>{FILTER_LABELS[item]}</span><strong>{counts[item]}</strong></button>)}
        </div>
        {subscription.lines.length > 1 ? <SelectField label="Window" className="product-select-trigger" value={windowId || ALL} onChange={value => setWindowId(value === ALL ? '' : value)} placeholder="All windows" options={[{ value: ALL, label: 'All windows' }, ...subscription.lines.map(line => ({ value: line.id, label: line.slotName }))]} /> : null}
      </div>
      {visibleDays.length === 0
        ? <p className="panel-empty">{filter === 'coming' ? (subscription.status === 'active' ? 'Nothing coming in the next two months.' : 'Nothing coming: this has ended.') : `No ${FILTER_LABELS[filter].toLowerCase()} days.`}</p>
        : <ol className="sub-days">
          {visibleDays.map(date => {
            const when = date === today ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : ''
            return <li key={date} className={`sub-day${date === today ? ' is-today' : ''}`}>
              <div className="sub-day-date"><span>{WEEKDAY.format(asUtc(date))}</span><strong>{DAY_MONTH.format(asUtc(date))}</strong>{when ? <em>{when}</em> : null}</div>
              <ul className="sub-day-lines">{shown.filter(line => line.date === date).map(line => <li key={line.lineId}>
                <div className="sub-day-what"><strong>{line.slotName} · {formatTime12h(line.startTime)}</strong><span>× {line.quantity}{line.orderId ? <> · <Link className="product-name-link" href={`/orders/${line.orderId}`}>{line.orderNumber}</Link></> : null}</span></div>
                <div className="sub-day-state"><span className={`day-state day-state-${STATE_CLASS[line.state]}`}>{DAY_LABELS[line.state]}</span><small>{hint(line)}</small></div>
                <div className="sub-day-action">{line.canChange ? <Button className="secondary-button" variant="outline" size="sm" disabled={busy} onClick={() => onChange(line)}>{line.state === 'skipped' ? 'Bring back' : 'Skip'}</Button> : null}</div>
              </li>)}</ul>
            </li>
          })}
        </ol>}
      {days.length > visibleDays.length ? <Button className="secondary-button sub-days-more" variant="outline" onClick={() => setShownDays(count => count + MORE_DAYS)}>Show more days ({days.length - visibleDays.length} left)</Button> : null}
    </div>
  </section>
}
