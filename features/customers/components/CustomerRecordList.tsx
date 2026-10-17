'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { customerRecordApi, type CustomerRecord, type CustomerRecordStatus, type CustomerRecordType } from '../api'
import { CUSTOMER_RECORD_STATUS_LABELS, CUSTOMER_RECORD_TYPE_LABELS, customerDisplayName, formatCustomerPhone } from '../record-schema'

const PAGE_SIZE = 10
const FILTERS = { status: ['active', 'deleted'], customerType: ['prepaid', 'credit'] } as const
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: CustomerRecord[]; total: number }

/** One page of customers, loaded from the backend with search and filters applied there. Staff do not add customers: they sign up in the app. */
export function CustomerRecordList() {
  const { search, page, filters, update, clear, hasActiveFilters } = useUrlListState(FILTERS)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  // An answer that arrives after a newer request is ignored.
  useEffect(() => {
    let cancelled = false
    customerRecordApi.list({ search, status: filters.status as CustomerRecordStatus | '', customerType: filters.customerType as CustomerRecordType | '', page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, filters.status, filters.customerType, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Customers could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const filtered = hasActiveFilters || Boolean(search)
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Manage' }, { label: 'Customers' }]} /><h1>Customers</h1><p className="page-description">People who signed up in the app. They create their own account with their email.</p></div>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search customers" value={search} onCommit={value => update({ search: value })} placeholder="Search by name, phone, or email..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status || ALL} onChange={value => update({ status: value === ALL ? null : value })} placeholder="Active customers" options={[{ value: ALL, label: 'Active customers' }, ...Object.entries(CUSTOMER_RECORD_STATUS_LABELS).filter(([value]) => value !== 'blocked').map(([value, label]) => ({ value, label }))]} />
        <SelectField label="Customer type" className="product-select-trigger" value={filters.customerType || ALL} onChange={value => update({ customerType: value === ALL ? null : value })} placeholder="All customer types" options={[{ value: ALL, label: 'All customer types' }, ...Object.entries(CUSTOMER_RECORD_TYPE_LABELS).map(([value, label]) => ({ value, label }))]} />
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{filtered ? 'No customers match these filters' : 'No customers yet'}</strong><span>{filtered ? 'Try changing your search or filters.' : 'Customers appear here as soon as they sign in to the app for the first time.'}</span>{filtered && <Button className="secondary-button" variant="outline" onClick={clear}>Clear filters</Button>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table customer-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Customer Type</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead><TableHead>Last Sign-in</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(customer => <TableRow key={customer.id}>
              <TableCell><span className="identity-cell"><InitialsAvatar name={customerDisplayName(customer)} /><Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.name.trim() || 'No name yet'}</Link></span></TableCell>
              <TableCell>{customer.email || '—'}</TableCell>
              <TableCell>{formatCustomerPhone(customer.phone)}</TableCell>
              <TableCell>{CUSTOMER_RECORD_TYPE_LABELS[customer.customerType]}</TableCell>
              <TableCell><StatusBadge status={customer.status === 'deleted' ? 'cancelled' : 'active'}>{CUSTOMER_RECORD_STATUS_LABELS[customer.status]}</StatusBadge></TableCell>
              <TableCell>{formatTimestamp(customer.createdAt)}</TableCell>
              <TableCell>{customer.lastSignInAt ? formatTimestamp(customer.lastSignInAt) : 'Never'}</TableCell>
              <TableCell><div className="row-actions product-row-actions">{customer.status !== 'deleted' && <Link href={`/customers/${customer.id}`} className="row-edit-action" aria-label={`Edit ${customerDisplayName(customer)}`}><Edit2 size={15} /></Link>}</div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{state.total} {state.total === 1 ? 'customer' : 'customers'} · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
  </div>
}
