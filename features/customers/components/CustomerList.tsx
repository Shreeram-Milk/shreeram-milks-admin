'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CircleOff, Edit2, MoreHorizontal, Plus, Repeat, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SelectField } from '@/components/ui/select-field'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatTimestamp } from '@/lib/business-time'
import { subscriptionService } from '../../subscriptions/service'
import { formatAreaAndPin, getPrimaryAddress } from '../address'
import { customerService } from '../service'
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TYPE_LABELS, type Customer } from '../types'
import { DeactivateCustomerDialog } from './DeactivateCustomerDialog'

const PAGE_SIZE = 8
const FILTERS = { status: ['active', 'inactive'], customerType: ['prepaid', 'credit'] } as const
const ALL = '__all__'

export function CustomerList() {
  const { search, page, filters, update, clear, hasActiveFilters } = useUrlListState(FILTERS)
  const [revision, setRevision] = useState(0)
  const [deactivating, setDeactivating] = useState<Customer | null>(null)
  const result = useMemo(() => {
    void revision
    return customerService.list({ search, status: filters.status as Customer['status'] | '', customerType: filters.customerType as Customer['customerType'] | '', page, pageSize: PAGE_SIZE })
  }, [search, filters.status, filters.customerType, page, revision])
  const counts = useMemo(() => { void revision; return subscriptionService.activeCountsByCustomer() }, [revision])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const hasAnyCustomers = hasActiveFilters || result.total > 0

  const reactivate = (customer: Customer) => {
    try { customerService.activate(customer.id); toast.success(`${customer.fullName} is active again.`); setRevision(value => value + 1) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to activate customer.') }
  }

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><h1>Customers</h1><p className="page-description">Manage customer profiles, addresses, subscriptions, and account status.</p></div>
      <Link className="primary-button" href="/customers/new"><Plus size={15} /> Add Customer</Link>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search customers" value={search} onCommit={value => update({ search: value })} placeholder="Search by name, mobile, area, or PIN..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={value => update({ status: value === ALL ? null : value })} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        <SelectField label="Customer type" className="product-select-trigger" value={filters.customerType} onChange={value => update({ customerType: value === ALL ? null : value })} placeholder="All customer types" options={[{ value: ALL, label: 'All customer types' }, { value: 'prepaid', label: 'Prepaid' }, { value: 'credit', label: 'Credit' }]} />
      </div>
      {!hasAnyCustomers ? <div className="product-state"><strong>No customers yet</strong><span>Add a customer to start managing their subscriptions.</span><Link className="primary-button" href="/customers/new"><Plus size={14} /> Add Customer</Link></div>
        : result.total === 0 ? <div className="product-state"><strong>No customers match these filters</strong><span>Try changing your search or filters.</span><Button className="secondary-button" variant="outline" onClick={clear}>Clear filters</Button></div>
          : <>
            <div className="table-card product-list-table-card"><Table className="config-table customer-table">
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Mobile</TableHead><TableHead>Area / PIN</TableHead><TableHead>Active Subscriptions</TableHead><TableHead>Customer Type</TableHead><TableHead>Status</TableHead><TableHead>Updated</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{result.rows.map(customer => {
                const subscriptions = counts.get(customer.id) ?? 0
                return <TableRow key={customer.id}>
                  <TableCell><span className="identity-cell"><InitialsAvatar name={customer.fullName} /><Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.fullName}</Link></span></TableCell>
                  <TableCell>{customer.mobile}</TableCell>
                  <TableCell>{formatAreaAndPin(getPrimaryAddress(customer))}</TableCell>
                  <TableCell>{subscriptions} {subscriptions === 1 ? 'active subscription' : 'active subscriptions'}</TableCell>
                  <TableCell>{CUSTOMER_TYPE_LABELS[customer.customerType]}</TableCell>
                  <TableCell><StatusBadge status={customer.status}>{CUSTOMER_STATUS_LABELS[customer.status]}</StatusBadge></TableCell>
                  <TableCell>{formatTimestamp(customer.updatedAt)}</TableCell>
                  <TableCell><div className="row-actions product-row-actions">
                    <Link href={`/customers/${customer.id}/edit`} className="row-edit-action" aria-label={`Edit ${customer.fullName}`}><Edit2 size={15} /></Link>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`More actions for ${customer.fullName}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/customers/${customer.id}/edit`}><Edit2 /> Edit customer</Link></DropdownMenuItem>
                        {customer.status === 'active' && <DropdownMenuItem asChild><Link href={`/customers/${customer.id}/subscriptions/new`}><Repeat /> Create subscription</Link></DropdownMenuItem>}
                        {customer.status === 'active' ? <DropdownMenuItem onSelect={() => setDeactivating(customer)}><CircleOff /> Deactivate</DropdownMenuItem> : <DropdownMenuItem onSelect={() => reactivate(customer)}><RotateCcw /> Activate</DropdownMenuItem>}
                      </DropdownMenuContent></DropdownMenu>
                  </div></TableCell>
                </TableRow>
              })}</TableBody>
            </Table></div>
            <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'customer' : 'customers'} · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
          </>}
    </section>
    <DeactivateCustomerDialog customer={deactivating} onClose={() => setDeactivating(null)} onDone={() => setRevision(value => value + 1)} />
  </div>
}
