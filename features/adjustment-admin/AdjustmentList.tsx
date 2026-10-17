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
    try { await adjustmentAdminApi.cancel(cancelling.id); toast.success('Adjustment cancelled.'); reload() } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false); setCancelling(null)
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Adjustments could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); reload() }}>Try again</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="owed" description="What you owe customers who paid first: refunds to send for cancelled or missed orders, credit on their account, and corrections. They appear here by themselves." actions={<Button className="primary-button" onClick={() => setCreating(true)}><Plus size={15} /> Add by hand</Button>} />
    <section className="product-list-section">
      <div className="list-toolbar">
        <div className="type-tabs" role="group" aria-label="Status">
          {(['pending', 'applied', 'cancelled', 'all'] as const).map(value => <button key={value} type="button" className={`type-tab${tab === value ? ' is-active' : ''}`} aria-pressed={tab === value} onClick={() => update({ status: value === 'pending' ? null : value })}><span>{value === 'all' ? 'All' : STATUS_LABELS[value]}</span></button>)}
        </div>
        <ListSearchInput label="Search" value={search} onCommit={value => update({ search: value })} placeholder="Customer, phone or order number" />
      </div>
      <div className="product-filter-row">
        <SelectField label="Type" className="product-select-trigger" value={filters.type || ALL} onChange={value => update({ type: value === ALL ? null : value })} placeholder="All types" options={[{ value: ALL, label: 'All types' }, ...ADJUSTMENT_TYPES.map(type => ({ value: type, label: TYPE_LABELS[type] }))]} />
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'Nothing matches' : tab === 'pending' ? 'Nothing to do' : 'Nothing here yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filters.' : 'Refunds for cancelled or missed orders appear here on their own.'}</span>{hasActiveFilters && <Button className="secondary-button" variant="outline" onClick={clear}>Clear filters</Button>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>What</TableHead><TableHead>Amount</TableHead><TableHead>Why</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(row => <TableRow key={row.id}>
              <TableCell>{row.customerName.trim() || 'No name'}<br /><small>{row.customerPhone}</small></TableCell>
              <TableCell>{TYPE_LABELS[row.type]}{row.orderNumber ? <><br /><small>Order {row.orderNumber}</small></> : null}</TableCell>
              <TableCell>{row.amountPaise === null ? (row.quantity ? `${row.quantity} × ${row.productName ?? ''} (${row.variantName ?? ''})` : '—') : formatINR(row.amountPaise)}</TableCell>
              <TableCell>{row.reason}</TableCell>
              <TableCell>{formatDisplayDate(row.effectiveDate)}</TableCell>
              <TableCell><StatusBadge status={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusBadge></TableCell>
              <TableCell>{row.status === 'pending' && <div className="row-actions product-row-actions"><Button variant="outline" className="secondary-button" onClick={() => setApplying(row)}>{row.type === 'refund_pending' ? 'Record refund' : 'Mark done'}</Button><Button variant="ghost" className="text-button" onClick={() => setCancelling(row)}>Cancel</Button></div>}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{state.total} {state.total === 1 ? 'item' : 'items'} · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
    {creating && <NewAdjustmentDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload() }} />}
    {applying && <ApplyDialog adjustment={applying} onClose={() => setApplying(null)} onDone={() => { setApplying(null); reload() }} />}
    <AlertDialog open={cancelling !== null} onOpenChange={open => { if (!open && !busy) setCancelling(null) }}>
      {cancelling && <AlertDialogContent className="confirm-dialog"><AlertDialogHeader><p className="eyebrow">Cancel adjustment</p><AlertDialogTitle>Cancel this adjustment?</AlertDialogTitle><AlertDialogDescription>It stays in the list as cancelled and nothing is owed for it any more. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Keep it</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={event => { event.preventDefault(); void cancel() }}>{busy ? 'Saving…' : 'Cancel adjustment'}</Button></AlertDialogAction></AlertDialogFooter></AlertDialogContent>}
    </AlertDialog>
  </div>
}

/** Prepaid adjustments: what the business owes prepaid customers. Refunds from cancelled or missed orders arrive here automatically. */
export function AdjustmentList() {
  return <Suspense fallback={<PageSkeleton />}><AdjustmentTable /></Suspense>
}
