'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { prepaidAdjustmentService } from '../service'
import { ADJUSTMENT_STATUS_LABELS, ADJUSTMENT_TYPE_LABELS, type PrepaidAdjustmentStatus, type PrepaidAdjustmentType } from '../types'
import { AdjustmentActions } from './AdjustmentActions'
import { adjustmentTypeLabel, adjustmentValue, AdjustmentStatusBadge } from './AdjustmentParts'
import { NewAdjustmentDialog } from './NewAdjustmentDialog'

const PAGE_SIZE = 10
const ALL = '__all__'
const FILTERS = { status: ['pending', 'applied', 'cancelled'], type: ['carry_forward', 'account_credit', 'refund_pending', 'manual_adjustment'], customer: 'free' } as const

export function PrepaidAdjustmentsList() {
  const { search, page, filters, update, hasActiveFilters } = useUrlListState(FILTERS)
  const [revision, setRevision] = useState(0)
  const [creating, setCreating] = useState(false)
  const result = useMemo(() => { void revision; return prepaidAdjustmentService.list({ search, status: filters.status as PrepaidAdjustmentStatus | '', type: filters.type as PrepaidAdjustmentType | '', customerId: filters.customer, page, pageSize: PAGE_SIZE }) }, [search, filters.status, filters.type, filters.customer, page, revision])
  const overview = useMemo(() => { void revision; return prepaidAdjustmentService.getOverview() }, [revision])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })
  const refresh = () => setRevision(value => value + 1)

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Finance' }, { label: 'Prepaid Adjustments' }]} /><h1>Prepaid Adjustments</h1><p className="page-description">What the business owes prepaid customers for deliveries they paid for but didn’t receive. Separate from credit accounts.</p></div>
      <Button className="primary-button" onClick={() => setCreating(true)}><Plus size={15} /> New Adjustment</Button>
    </header>
    <section className="product-list-section">
      <dl className="delivery-metrics" aria-label="Pending prepaid adjustments">
        <div><dt>Pending adjustments</dt><dd>{overview.pendingCount}</dd></div>
        <div className="metric-strong"><dt>Pending value</dt><dd>{formatINR(overview.pendingValuePaise)}</dd></div>
        <div><dt>Refunds pending</dt><dd>{overview.refundPendingCount}</dd></div>
      </dl>
      <ListSearchInput label="Search prepaid adjustments" value={search} onCommit={value => update({ search: value })} placeholder="Search by customer, mobile, product, or reason..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(ADJUSTMENT_STATUS_LABELS) as PrepaidAdjustmentStatus[]).map(value => ({ value, label: ADJUSTMENT_STATUS_LABELS[value] }))]} />
        <SelectField label="Type" className="product-select-trigger" value={filters.type} onChange={set('type')} placeholder="All types" options={[{ value: ALL, label: 'All types' }, ...(Object.keys(ADJUSTMENT_TYPE_LABELS) as PrepaidAdjustmentType[]).map(value => ({ value, label: ADJUSTMENT_TYPE_LABELS[value] }))]} />
      </div>
      {filters.customer && <p className="product-hint">Showing one customer’s adjustments. <Button type="button" variant="link" className="inline-link" onClick={() => update({ customer: null })}>Show everyone</Button></p>}
      {result.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'No adjustments match these filters' : 'No prepaid adjustments yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filters.' : 'They appear here when a prepaid customer’s paid delivery is skipped or their subscription is cancelled.'}</span>{hasActiveFilters && <Button className="secondary-button" variant="outline" onClick={() => update({ search: null, status: null, type: null, customer: null })}>Clear filters</Button>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table credit-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Source</TableHead><TableHead>Type</TableHead><TableHead>Value / Entitlement</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{result.rows.map(({ adjustment, customer }) => <TableRow key={adjustment.id}>
              <TableCell><span className="identity-cell"><InitialsAvatar name={customer?.fullName ?? '?'} /><Link className="product-name-link" href={`/customers/${adjustment.customerId}`}>{customer?.fullName ?? 'Unknown customer'}</Link></span></TableCell>
              <TableCell>{adjustment.deliveryId ? <Link className="product-name-link" href={`/deliveries/${adjustment.deliveryId}`}>{adjustment.reason}</Link> : adjustment.reason}</TableCell>
              <TableCell>{adjustmentTypeLabel(adjustment)}</TableCell>
              <TableCell>{adjustment.entitlement ? adjustmentValue(adjustment) : <strong>{adjustmentValue(adjustment)}</strong>}</TableCell>
              <TableCell><AdjustmentStatusBadge adjustment={adjustment} /></TableCell>
              <TableCell>{formatDisplayDate(adjustment.effectiveDate)}</TableCell>
              <TableCell><div className="row-actions product-row-actions"><AdjustmentActions adjustment={adjustment} customerName={customer?.fullName ?? 'this customer'} onChanged={refresh} /></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'adjustment' : 'adjustments'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
        </>}
    </section>
    <NewAdjustmentDialog open={creating} onOpenChange={setCreating} onDone={refresh} />
  </div>
}
