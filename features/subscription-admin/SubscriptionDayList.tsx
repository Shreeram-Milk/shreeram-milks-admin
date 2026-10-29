'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { addDays, formatDateTime, formatTime12h, todayInBusinessZone } from '@/lib/business-time'
import { liveLabels, localeOf } from '@/lib/i18n/core'
import { DAY_LABELS, SKIP_REASON_LABELS, type DayLine, type DayLineState, type SubscriptionDetail } from './api'
import { t, type SubscriptionKey } from './messages'

type Filter = 'coming' | 'skipped' | 'paused' | 'done' | 'all'
export type DayRow = DayLine & { date: string }

const FIRST_DAYS = 10
const MORE_DAYS = 14
const ALL = '__all__'
const GROUP: Record<DayLineState, Exclude<Filter, 'all'>> = { upcoming: 'coming', placed: 'coming', out_for_delivery: 'coming', delivered: 'done', missed: 'done', skipped: 'skipped', paused: 'paused' }
const STATE_CLASS: Record<DayLineState, string> = { upcoming: 'coming', placed: 'coming', out_for_delivery: 'moving', delivered: 'done', missed: 'missed', skipped: 'skipped', paused: 'paused' }
const FILTER_LABELS = liveLabels(t, { coming: 'filterComing', skipped: 'filterSkipped', paused: 'filterPaused', done: 'filterDone', all: 'filterAll' } satisfies Record<Filter, SubscriptionKey>)

// Made when used, so the weekday and month follow the admin's language.
const WEEKDAY = { format: (date: Date) => new Intl.DateTimeFormat(localeOf(), { weekday: 'short', timeZone: 'UTC' }).format(date) }
const DAY_MONTH = { format: (date: Date) => new Intl.DateTimeFormat(localeOf(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date) }
const asUtc = (date: string) => new Date(`${date}T00:00:00Z`)

/** One line under a window: until when it can change, or why it will not come. */
function hint(line: DayRow): string {
  if (line.state === 'skipped') return line.skipReason ? SKIP_REASON_LABELS[line.skipReason] : t('hintSkipped')
  if (line.state === 'paused') return t('hintPaused')
  if (line.state === 'delivered' || line.state === 'missed') return ''
  if (line.canChange) return line.changeUntil ? t('canSkipUntil', { when: formatDateTime(line.changeUntil) }) : t('canStillSkip')
  return t('locked')
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
    <header className="panel-header"><div><h2 id="sub-days-title">{t('deliveryDays')}</h2><p>{t('deliveryDaysIntro')}</p></div></header>
    <div className="panel-body">
      <div className="sub-days-toolbar">
        <div className="type-tabs" role="group" aria-label={t('showDays')}>
          {filters.map(item => <button key={item} type="button" className={`type-tab${filter === item ? ' is-active' : ''}`} aria-pressed={filter === item} onClick={() => { setFilter(item); setShownDays(FIRST_DAYS) }}><span>{FILTER_LABELS[item]}</span><strong>{counts[item]}</strong></button>)}
        </div>
        {subscription.lines.length > 1 ? <SelectField label={t('window')} className="product-select-trigger" value={windowId || ALL} onChange={value => setWindowId(value === ALL ? '' : value)} placeholder={t('allWindows')} options={[{ value: ALL, label: t('allWindows') }, ...subscription.lines.map(line => ({ value: line.id, label: line.slotName }))]} /> : null}
      </div>
      {visibleDays.length === 0
        ? <p className="panel-empty">{filter === 'coming' ? (subscription.status === 'active' ? t('nothingComing') : t('nothingEnded')) : t('noDaysOf', { filter: FILTER_LABELS[filter].toLowerCase() })}</p>
        : <ol className="sub-days">
          {visibleDays.map(date => {
            const when = date === today ? t('today') : date === addDays(today, 1) ? t('tomorrow') : ''
            return <li key={date} className={`sub-day${date === today ? ' is-today' : ''}`}>
              <div className="sub-day-date"><span>{WEEKDAY.format(asUtc(date))}</span><strong>{DAY_MONTH.format(asUtc(date))}</strong>{when ? <em>{when}</em> : null}</div>
              <ul className="sub-day-lines">{shown.filter(line => line.date === date).map(line => <li key={line.lineId}>
                <div className="sub-day-what"><strong>{line.slotName} · {formatTime12h(line.startTime)}</strong><span>× {line.quantity}{line.orderId ? <> · <Link className="product-name-link" href={`/orders/${line.orderId}`}>{line.orderNumber}</Link></> : null}</span></div>
                <div className="sub-day-state"><span className={`day-state day-state-${STATE_CLASS[line.state]}`}>{DAY_LABELS[line.state]}</span><small>{hint(line)}</small></div>
                <div className="sub-day-action">{line.canChange ? <Button className="secondary-button" variant="outline" size="sm" disabled={busy} onClick={() => onChange(line)}>{line.state === 'skipped' ? t('bringBack') : t('skip')}</Button> : null}</div>
              </li>)}</ul>
            </li>
          })}
        </ol>}
      {days.length > visibleDays.length ? <Button className="secondary-button sub-days-more" variant="outline" onClick={() => setShownDays(count => count + MORE_DAYS)}>{t('showMore', { count: days.length - visibleDays.length })}</Button> : null}
    </div>
  </section>
}
