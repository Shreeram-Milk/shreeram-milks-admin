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
import { tc } from '@/lib/i18n/common'
import { addDays, formatDisplayDate, todayInBusinessZone } from '@/lib/business-time'
import { KIND_TEXT, SKIP_REASON_LABELS, STATE_LABELS, STATE_TONE, SUBSCRIPTION_STATES, linesText, scheduleText, subscriptionAdminApi, type SubscriptionAlert, type SubscriptionKind, type SubscriptionRow, type SubscriptionState } from './api'
import { t } from './messages'

const PAGE_SIZE = 20
/** No status in the link means "Active": that is what staff look at most. "all" shows every state. */
const FILTERS = { status: [...SUBSCRIPTION_STATES, 'all'] } as const

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: SubscriptionRow[]; total: number; counts: Record<SubscriptionState, number>; alerts: SubscriptionAlert[] }

const stateOf = (row: SubscriptionRow): SubscriptionState => (row.status === 'active' && row.paused ? 'paused' : row.status)

/** "Today", "Tomorrow" or the date, so the next delivery reads at a glance. */
function dayWord(date: string): string {
  const today = todayInBusinessZone()
  if (date === today) return t('today')
  if (date === addDays(today, 1)) return t('tomorrow')
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
      toast.success(result.created === 0 ? t('upToDate') : t(result.created === 1 ? 'ordersMadeOne' : 'ordersMadeMany', { count: result.created }))
      if (result.failures > 0) toast.error(t('failuresRetry', { count: result.failures }))
      setReloadKey(count => count + 1)
    } catch (failure) { toast.error(describeApiError(failure)) }
    setRunning(false)
  }

  const kindTabs = <PageTabs label={t('kindTabs')} tabs={(['subscription', 'trial'] as const).map(item => ({ href: KIND_TEXT[item].path, label: KIND_TEXT[item].plural, active: item === kind }))} />
  const header = <header className="page-header">
    <div><PageBreadcrumbs items={[{ label: t('subscriptions') }, { label: text.plural }]} /><h1>{t('subscriptions')}</h1><p className="page-description">{t('listDescription')}</p></div>
    <div className="header-actions"><Button className="secondary-button" variant="outline" disabled={running} onClick={() => void runNow()} title={t('runNowHint')}><RefreshCw size={14} /> {running ? t('makingOrders') : t('makeOrdersNow')}</Button></div>
  </header>

  if (state.status === 'loading') return <div className="workspace-page products-page">{header}{kindTabs}<PageSkeleton /></div>
  if (state.status === 'error') return <div className="workspace-page products-page">{header}{kindTabs}<div className="product-state" role="alert"><strong>{t('listFailed', { kind: text.plural })}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div></div>

  const { counts, alerts } = state
  const allCount = SUBSCRIPTION_STATES.reduce((sum, item) => sum + counts[item], 0)
  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const statusTab = (value: SubscriptionState | 'all', label: string, count: number) => <button key={value} type="button" className={`type-tab${tab === value ? ' is-active' : ''}`} aria-pressed={tab === value} onClick={() => update({ status: value === 'active' ? null : value })}><span>{label}</span><strong>{count}</strong></button>

  return <div className="workspace-page products-page">
    {header}
    {kindTabs}
    {alerts.length > 0 ? <div className="setup-note attention" role="status"><div><strong>{alerts.length === 1 ? t('skippedBySystemOne') : t('skippedBySystemMany', { count: alerts.length })}</strong>
      <span>{t('skippedDetail')}</span>
      <ul>{alerts.slice(0, 5).map(alert => <li key={`${alert.subscriptionId}-${alert.date}-${alert.slotName}`}><Link className="product-name-link" href={`/subscriptions/${alert.subscriptionId}`}>{alert.customerName || alert.subscriptionNumber}</Link> · {formatDisplayDate(alert.date)} {alert.slotName}: {SKIP_REASON_LABELS[alert.reason]}</li>)}</ul>
    </div></div> : null}
    <section className="product-list-section">
      <div className="list-toolbar">
        <div className="type-tabs" role="group" aria-label={t('status')}>
          {statusTab('active', STATE_LABELS.active, counts.active)}
          {statusTab('paused', STATE_LABELS.paused, counts.paused)}
          {statusTab('completed', STATE_LABELS.completed, counts.completed)}
          {statusTab('cancelled', STATE_LABELS.cancelled, counts.cancelled)}
          {statusTab('all', t('all'), allCount)}
        </div>
        <ListSearchInput label={t('searchKind', { kind: text.plural.toLowerCase() })} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{search ? t('noSearchMatch', { kind: text.plural.toLowerCase() }) : tab === 'all' ? t('noneAtAll', { kind: text.plural.toLowerCase() }) : t('noneInState', { state: STATE_LABELS[tab].toLowerCase(), kind: text.plural.toLowerCase() })}</strong><span>{search ? t('tryAnother') : t('appearHere', { kind: text.plural })}</span>{search ? <Button className="secondary-button" variant="outline" onClick={clear}>{t('clearSearch')}</Button> : null}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('customer')}</TableHead><TableHead>{t('whatTheyGet')}</TableHead><TableHead>{t('nextDelivery')}</TableHead><TableHead>{t('delivered')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(row => {
              const rowState = stateOf(row)
              const planned = row.deliveriesPerLine * row.lines.length
              const share = planned > 0 ? Math.min(100, Math.round((row.deliveredDeliveries / planned) * 100)) : 0
              return <TableRow key={row.id}>
                <TableCell><Link className="product-name-link" href={`${text.path}/${row.id}`}>{row.customerName.trim() || t('noName')}</Link><br /><small>{row.customerPhone} · {row.number}</small></TableCell>
                <TableCell>{row.productName} {row.variantName}<br /><small>{row.planName || scheduleText(row.scheduleType, row.weekdays)} · {linesText(row.lines)}</small></TableCell>
                <TableCell>{row.nextDelivery ? <><strong>{dayWord(row.nextDelivery.date)}</strong><br /><small>{row.nextDelivery.slotName}</small></> : <small>{rowState === 'paused' ? t('paused') : rowState === 'active' ? t('orderNotMade') : '—'}</small>}{row.alerts > 0 ? <><br /><small className="field-error">{t('skippedBySystem', { count: row.alerts })}</small></> : null}</TableCell>
                <TableCell><div className="progress-cell"><span className="progress-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></span><small>{t('deliveredOf', { done: row.deliveredDeliveries, total: planned })}</small></div></TableCell>
                <TableCell><StatusBadge status={STATE_TONE[rowState]}>{STATE_LABELS[rowState]}</StatusBadge></TableCell>
              </TableRow>
            })}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{state.total} {state.total === 1 ? text.singular.toLowerCase() : text.plural.toLowerCase()}{pageCount > 1 ? t('pageOf', { page, count: pageCount }) : ''}</span>{pageCount > 1 ? <TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /> : null}</div>
        </>}
    </section>
  </div>
}
