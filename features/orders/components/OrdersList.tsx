'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Edit2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatDisplayDate, formatTimestamp, isIsoDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { productService } from '../../products/service'
import { orderService } from '../service'
import { ORDER_STATUS_LABELS, type OrderStatus } from '../types'
import { OrderStatusBadge } from './OrderStatusBadge'

const PAGE_SIZE = 10
const ALL = '__all__'
const FILTERS = { status: ['draft', 'confirmed', 'scheduled', 'fulfilled', 'cancelled'], product: 'free', date: 'free', customer: 'free' } as const

function summarizeItems(names: string[], extra: number): string {
  return `${names.join(', ')}${extra > 0 ? ` +${extra} more` : ''}`
}

export function OrdersList() {
  const { search, page, filters, update, hasActiveFilters } = useUrlListState(FILTERS)
  const products = useMemo(() => productService.list().filter(product => product.purchaseMethods.includes('buy_once')), [])
  const date = isIsoDate(filters.date) ? filters.date : ''
  const result = useMemo(() => orderService.list({ search, status: filters.status as OrderStatus | '', date, customerId: filters.customer, productId: filters.product, page, pageSize: PAGE_SIZE }), [search, filters.status, date, filters.customer, filters.product, page])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Commerce' }, { label: 'Orders' }]} /><h1>Orders</h1><p className="page-description">Manage one-time Buy Once orders and their deliveries.</p></div>
      <Link className="primary-button" href="/orders/new"><Plus size={15} /> Create Order</Link>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search orders" value={search} onCommit={value => update({ search: value })} placeholder="Search by order number, customer, mobile, or product..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(value => ({ value, label: ORDER_STATUS_LABELS[value] }))]} />
        <SelectField label="Product" className="product-select-trigger" value={filters.product} onChange={set('product')} placeholder="All products" options={[{ value: ALL, label: 'All products' }, ...products.map(product => ({ value: product.id, label: product.name }))]} />
        <div className="filter-date"><DatePickerField label="Delivery date" value={date} onChange={value => update({ date: value })} placeholder="Any delivery date" />{date && <Button type="button" variant="ghost" className="filter-date-clear" onClick={() => update({ date: null })}>Clear date</Button>}</div>
      </div>
      {filters.customer && <p className="product-hint">Showing orders for one customer. <Button type="button" variant="link" className="inline-link" onClick={() => update({ customer: null })}>Show all customers</Button></p>}
      {result.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'No orders match these filters' : 'No orders yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filters.' : 'Create a Buy Once order to schedule a one-time delivery.'}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={() => update({ search: null, status: null, product: null, date: null, customer: null })}>Clear filters</Button> : <Link className="primary-button" href="/orders/new"><Plus size={14} /> Create Order</Link>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table orders-table">
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead><TableHead className="numeric">Total</TableHead><TableHead>Delivery Date</TableHead><TableHead>Slot</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{result.rows.map(({ order, customer, slot, status }) => <TableRow key={order.id}>
              <TableCell><Link className="product-name-link" href={`/orders/${order.id}`}>{order.orderNumber}</Link></TableCell>
              <TableCell><span className="identity-cell"><InitialsAvatar name={customer?.fullName ?? '?'} /><span>{customer?.fullName ?? 'Unknown customer'}</span></span></TableCell>
              <TableCell>{summarizeItems(order.items.slice(0, 2).map(item => `${item.productNameSnapshot} ${item.variantNameSnapshot} × ${item.quantity}`), order.items.length - 2)}</TableCell>
              <TableCell className="numeric"><strong>{formatINR(order.totalPaise)}</strong></TableCell>
              <TableCell>{order.deliveryDate ? formatDisplayDate(order.deliveryDate) : '—'}</TableCell>
              <TableCell>{slot?.name ?? (order.deliverySlotId ? 'Unavailable slot' : '—')}</TableCell>
              <TableCell><OrderStatusBadge status={status} /></TableCell>
              <TableCell>{formatTimestamp(order.createdAt)}</TableCell>
              <TableCell><div className="row-actions product-row-actions">{(status === 'draft' || status === 'confirmed' || status === 'scheduled') && <Link href={`/orders/${order.id}/edit`} className="row-edit-action" aria-label={`Edit ${order.orderNumber}`}><Edit2 size={15} /></Link>}</div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'order' : 'orders'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
        </>}
    </section>
  </div>
}
