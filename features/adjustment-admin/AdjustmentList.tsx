'use client'

import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { ADJUSTMENT_STATUSES, ADJUSTMENT_TYPES, STATUS_LABELS, STATUS_TONE, TYPE_LABELS, adjustmentAdminApi, type Adjustment, type AdjustmentStatus, type AdjustmentType } from './api'
import { ApplyDialog, NewAdjustmentDialog } from './AdjustmentDialogs'
import { MoneyHeader } from '../money/MoneyHeader'
import { tc } from '@/lib/i18n/common'
import { t } from './messages'

const PAGE_SIZE = 15
/** No status in the link means "To do": what still needs doing. "all" shows everything. */
const FILTERS = { status: [...ADJUSTMENT_STATUSES, 'all'], type: ADJUSTMENT_TYPES } as const
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: Adjustment[]; total: number }

function AdjustmentTable() {
  const { search, page, filters, update, clear } = useUrlListState(FILTERS)
  const tab = (filters.status || 'pending') as AdjustmentStatus | 'all'
  const hasActiveFilters = Boolean(search || filters.type)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [applying, setApplying] = useState<Adjustment | null>(null)
  const [cancelling, setCancelling] = useState<Adjustment | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = () => setReloadKey(count => count + 1)

  useEffect(() => {
    let cancelled = false
    adjustmentAdminApi.list({ search, status: tab === 'all' ? '' : tab, type: filters.type as AdjustmentType | '', page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, tab, filters.type, page, reloadKey])

  const cancel = async () => {
    if (!cancelling) return
    setBusy(true)
    try { await adjustmentAdminApi.cancel(cancelling.id); toast.success(t('cancelled')); reload() } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false); setCancelling(null)
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); reload() }}>{tc('tryAgain')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="owed" description={t('description')} actions={<Button className="primary-button" onClick={() => setCreating(true)}><Plus size={15} /> {t('addByHand')}</Button>} />
    <section className="product-list-section">
      <div className="list-toolbar">
        <div className="type-tabs" role="group" aria-label={t('status')}>
          {(['pending', 'applied', 'cancelled', 'all'] as const).map(value => <button key={value} type="button" className={`type-tab${tab === value ? ' is-active' : ''}`} aria-pressed={tab === value} onClick={() => update({ status: value === 'pending' ? null : value })}><span>{value === 'all' ? t('all') : STATUS_LABELS[value]}</span></button>)}
        </div>
        <ListSearchInput label={t('search')} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
      </div>
      <div className="product-filter-row">
        <SelectField label={t('type')} className="product-select-trigger" value={filters.type || ALL} onChange={value => update({ type: value === ALL ? null : value })} placeholder={t('allTypes')} options={[{ value: ALL, label: t('allTypes') }, ...ADJUSTMENT_TYPES.map(type => ({ value: type, label: TYPE_LABELS[type] }))]} />
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? t('nothingMatches') : tab === 'pending' ? t('nothingToDo') : t('nothingYet')}</strong><span>{hasActiveFilters ? t('tryChanging') : t('appearOnOwn')}</span>{hasActiveFilters && <Button className="secondary-button" variant="outline" onClick={clear}>{tc('clearFilters')}</Button>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('customer')}</TableHead><TableHead>{t('what')}</TableHead><TableHead>{t('amount')}</TableHead><TableHead>{t('why')}</TableHead><TableHead>{t('date')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('actions')}</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(row => <TableRow key={row.id}>
              <TableCell>{row.customerName.trim() || t('noName')}<br /><small>{row.customerPhone}</small></TableCell>
              <TableCell>{TYPE_LABELS[row.type]}{row.orderNumber ? <><br /><small>{t('order', { number: row.orderNumber })}</small></> : null}</TableCell>
              <TableCell>{row.amountPaise === null ? (row.quantity ? `${row.quantity} × ${row.productName ?? ''} (${row.variantName ?? ''})` : '—') : formatINR(row.amountPaise)}</TableCell>
              <TableCell>{row.reason}</TableCell>
              <TableCell>{formatDisplayDate(row.effectiveDate)}</TableCell>
              <TableCell><StatusBadge status={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge></TableCell>
              <TableCell>{row.status === 'pending' && <div className="row-actions product-row-actions"><Button variant="outline" className="secondary-button" onClick={() => setApplying(row)}>{row.type === 'refund_pending' ? t('recordRefund') : t('markDone')}</Button><Button variant="ghost" className="text-button" onClick={() => setCancelling(row)}>{t('cancel')}</Button></div>}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(state.total === 1 ? 'itemOne' : 'itemMany', { count: state.total })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
    {creating && <NewAdjustmentDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload() }} />}
    {applying && <ApplyDialog adjustment={applying} onClose={() => setApplying(null)} onDone={() => { setApplying(null); reload() }} />}
    <AlertDialog open={cancelling !== null} onOpenChange={open => { if (!open && !busy) setCancelling(null) }}>
      {cancelling && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">{t('cancelEyebrow')}</p><AlertDialogTitle>{t('cancelTitle')}</AlertDialogTitle><AlertDialogDescription>{t('cancelBody')}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('keepIt')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={event => { event.preventDefault(); void cancel() }}>{busy ? t('saving') : t('cancelAdjustment')}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </div>
}

/** Prepaid adjustments: what the business owes prepaid customers. Refunds from cancelled or missed orders arrive here automatically. */
export function AdjustmentList() {
  return <Suspense fallback={<PageSkeleton />}><AdjustmentTable /></Suspense>
}
