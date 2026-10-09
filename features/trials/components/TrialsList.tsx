'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatDisplayDate, isIsoDate } from '@/lib/business-time'
import { trialService } from '../service'
import { TRIAL_STATUS_LABELS, type TrialStatus } from '../types'
import { TrialStatusBadge } from './TrialStatusBadge'

const PAGE_SIZE = 10
const ALL = '__all__'
const FILTERS = { status: ['upcoming', 'active', 'completed', 'cancelled', 'converted'], product: 'free', date: 'free' } as const

export function TrialsList() {
  const { search, page, filters, update, hasActiveFilters } = useUrlListState(FILTERS)
  const products = useMemo(() => trialService.listTrialProducts(), [])
  const date = isIsoDate(filters.date) ? filters.date : ''
  const result = useMemo(() => trialService.list({ search, status: filters.status as TrialStatus | '', productId: filters.product, date, page, pageSize: PAGE_SIZE }), [search, filters.status, filters.product, date, page])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Commerce' }, { label: 'Trials' }]} /><h1>Trials</h1><p className="page-description">Short trials that let customers try a product before subscribing.</p></div>
      <Link className="primary-button" href="/trials/new"><Plus size={15} /> Create Trial</Link>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search trials" value={search} onCommit={value => update({ search: value })} placeholder="Search by customer, mobile, or product..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(TRIAL_STATUS_LABELS) as TrialStatus[]).map(value => ({ value, label: TRIAL_STATUS_LABELS[value] }))]} />
        <SelectField label="Product" className="product-select-trigger" value={filters.product} onChange={set('product')} placeholder="All products" options={[{ value: ALL, label: 'All products' }, ...products.map(product => ({ value: product.id, label: product.name }))]} />
        <div className="filter-date"><DatePickerField label="Running on" value={date} onChange={value => update({ date: value })} placeholder="Running on any date" />{date && <Button type="button" variant="ghost" className="filter-date-clear" onClick={() => update({ date: null })}>Clear date</Button>}</div>
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'No trials match these filters' : 'No trials yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filters.' : 'Create a trial to let a customer try a product.'}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={() => update({ search: null, status: null, product: null, date: null })}>Clear filters</Button> : <Link className="primary-button" href="/trials/new"><Plus size={14} /> Create Trial</Link>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table trials-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Variant</TableHead><TableHead>Plan</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Slot</TableHead><TableHead>Status</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{result.rows.map(({ trial, customer, product, variant, slot, status }) => <TableRow key={trial.id}>
              <TableCell><span className="identity-cell"><InitialsAvatar name={customer?.fullName ?? '?'} /><Link className="product-name-link" href={`/trials/${trial.id}`}>{customer?.fullName ?? 'Unknown customer'}</Link></span></TableCell>
              <TableCell>{product?.name ?? 'Unavailable product'}</TableCell>
              <TableCell>{variant?.name ?? '—'}</TableCell>
              <TableCell>{trial.trialPlanNameSnapshot}</TableCell>
              <TableCell>{formatDisplayDate(trial.startDate)}</TableCell>
              <TableCell>{formatDisplayDate(trial.endDate)}</TableCell>
              <TableCell>{slot?.name ?? (trial.deliverySlotId ? 'Unavailable slot' : '—')}</TableCell>
              <TableCell><TrialStatusBadge status={status} /></TableCell>
              <TableCell><div className="row-actions product-row-actions"><Link className="secondary-button delivery-action" href={`/trials/${trial.id}`}>View</Link></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'trial' : 'trials'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
        </>}
    </section>
  </div>
}
