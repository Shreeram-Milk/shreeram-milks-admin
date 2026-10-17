'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageTabs } from '@/components/shared/PageTabs'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { addDays, formatDisplayDate, todayInBusinessZone } from '@/lib/business-time'
import { KIND_TEXT, SKIP_REASON_LABELS, STATE_LABELS, STATE_TONE, SUBSCRIPTION_STATES, linesText, scheduleText, subscriptionAdminApi, type SubscriptionAlert, type SubscriptionKind, type SubscriptionRow, type SubscriptionState } from './api'

const PAGE_SIZE = 20
/** No status in the link means "Active": that is what staff look at most. "all" shows every state. */
const FILTERS = { status: [...SUBSCRIPTION_STATES, 'all'] } as const

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: SubscriptionRow[]; total: number; counts: Record<SubscriptionState, number>; alerts: SubscriptionAlert[] }

const stateOf = (row: SubscriptionRow): SubscriptionState => (row.status === 'active' && row.paused ? 'paused' : row.status)

/** "Today", "Tomorrow" or the date, so the next delivery reads at a glance. */
function dayWord(date: string): string {
  const today = todayInBusinessZone()
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return formatDisplayDate(date)
}

/** Subscriptions and trials on one page, a tab each, split by status with a count on every tab. */
export function SubscriptionAdminList({ kind }: { kind: SubscriptionKind }) {
  const text = KIND_TEXT[kind]
  const { search, page, filters, update, clear } = useUrlListState(FILTERS)
  const tab: SubscriptionState | 'all' = (filters.status || 'active') as SubscriptionState | 'all'
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancelled = false
    subscriptionAdminApi.list({ search, kind, status: tab === 'all' ? '' : tab, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, kind, tab, page, reloadKey])

  const runNow = async () => {
    setRunning(true)
    try {
      const result = await subscriptionAdminApi.runNow()
      toast.success(result.created === 0 ? 'Everything is up to date. No new orders were needed.' : `${result.created} delivery ${result.created === 1 ? 'order' : 'orders'} made.`)
      if (result.failures > 0) toast.error(`${result.failures} could not be processed. They will be tried again in a few minutes.`)
      setReloadKey(count => count + 1)
    } catch (failure) { toast.error(describeApiError(failure)) }
    setRunning(false)
  }

  const kindTabs = <PageTabs label="Subscriptions or trials" tabs={(['subscription', 'trial'] as const).map(item => ({ href: KIND_TEXT[item].path, label: KIND_TEXT[item].plural, active: item === kind }))} />
  const header = <header className="page-header">
    <div><PageBreadcrumbs items={[{ label: 'Subscriptions' }, { label: text.plural }]} /><h1>Subscriptions</h1><p className="page-description">Repeat deliveries and trial packs customers started in the app. Each delivery becomes a normal order 3 days ahead, all by itself.</p></div>
    <div className="header-actions"><Button className="secondary-button" variant="outline" disabled={running} onClick={() => void runNow()} title="This also happens automatically every few minutes."><RefreshCw size={14} /> {running ? 'Making orders…' : 'Make coming orders now'}</Button></div>
  </header>

  if (state.status === 'loading') return <div className="workspace-page products-page">{header}{kindTabs}<PageSkeleton /></div>
  if (state.status === 'error') return <div className="workspace-page products-page">{header}{kindTabs}<div className="product-state" role="alert"><strong>{text.plural} could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div></div>

  const { counts, alerts } = state
  const allCount = SUBSCRIPTION_STATES.reduce((sum, item) => sum + counts[item], 0)
  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const statusTab = (value: SubscriptionState | 'all', label: string, count: number) => <button key={value} type="button" className={`type-tab${tab === value ? ' is-active' : ''}`} aria-pressed={tab === value} onClick={() => update({ status: value === 'active' ? null : value })}><span>{label}</span><strong>{count}</strong></button>

  return <div className="workspace-page products-page">
    {header}
    {kindTabs}
    {alerts.length > 0 ? <div className="setup-note attention" role="status"><div><strong>{alerts.length === 1 ? '1 delivery was skipped by the system' : `${alerts.length} deliveries were skipped by the system`} in the last 7 days</strong>
      <span>Each one is added at the end of the plan, so nothing is lost. Call the customer if needed.</span>
      <ul>{alerts.slice(0, 5).map(alert => <li key={`${alert.subscriptionId}-${alert.date}-${alert.slotName}`}><Link className="product-name-link" href={`/subscriptions/${alert.subscriptionId}`}>{alert.customerName || alert.subscriptionNumber}</Link> · {formatDisplayDate(alert.date)} {alert.slotName}: {SKIP_REASON_LABELS[alert.reason]}</li>)}</ul>
    </div></div> : null}
    <section className="product-list-section">
      <div className="list-toolbar">
        <div className="type-tabs" role="group" aria-label="Status">
          {statusTab('active', STATE_LABELS.active, counts.active)}
          {statusTab('paused', STATE_LABELS.paused, counts.paused)}
          {statusTab('completed', STATE_LABELS.completed, counts.completed)}
          {statusTab('cancelled', STATE_LABELS.cancelled, counts.cancelled)}
          {statusTab('all', 'All', allCount)}
        </div>
        <ListSearchInput label={`Search ${text.plural.toLowerCase()}`} value={search} onCommit={value => update({ search: value })} placeholder="Name, phone, product or PIN" />
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{search ? `No ${text.plural.toLowerCase()} match this search` : `No ${tab === 'all' ? '' : `${STATE_LABELS[tab].toLowerCase()} `}${text.plural.toLowerCase()}`}</strong><span>{search ? 'Try another name or number.' : `${text.plural} appear here as soon as a customer starts one in the app.`}</span>{search ? <Button className="secondary-button" variant="outline" onClick={clear}>Clear search</Button> : null}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>What they get</TableHead><TableHead>Next delivery</TableHead><TableHead>Delivered</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(row => {
              const rowState = stateOf(row)
              const planned = row.deliveriesPerLine * row.lines.length
              const share = planned > 0 ? Math.min(100, Math.round((row.deliveredDeliveries / planned) * 100)) : 0
              return <TableRow key={row.id}>
                <TableCell><Link className="product-name-link" href={`${text.path}/${row.id}`}>{row.customerName.trim() || 'No name'}</Link><br /><small>{row.customerPhone} · {row.number}</small></TableCell>
                <TableCell>{row.productName} {row.variantName}<br /><small>{row.planName || scheduleText(row.scheduleType, row.weekdays)} · {linesText(row.lines)}</small></TableCell>
                <TableCell>{row.nextDelivery ? <><strong>{dayWord(row.nextDelivery.date)}</strong><br /><small>{row.nextDelivery.slotName}</small></> : <small>{rowState === 'paused' ? 'Paused' : rowState === 'active' ? 'Order not made yet' : '—'}</small>}{row.alerts > 0 ? <><br /><small className="field-error">{row.alerts} skipped by the system</small></> : null}</TableCell>
                <TableCell><div className="progress-cell"><span className="progress-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></span><small>{row.deliveredDeliveries} of {planned} delivered</small></div></TableCell>
                <TableCell><StatusBadge status={STATE_TONE[rowState]}>{STATE_LABELS[rowState]}</StatusBadge></TableCell>
              </TableRow>
            })}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{state.total} {state.total === 1 ? text.singular.toLowerCase() : text.plural.toLowerCase()}{pageCount > 1 ? ` · Page ${page} of ${pageCount}` : ''}</span>{pageCount > 1 ? <TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /> : null}</div>
        </>}
    </section>
  </div>
}
