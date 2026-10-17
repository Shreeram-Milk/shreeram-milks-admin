'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PackageCheck, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { addDays, formatDisplayDate, formatTime12h, formatWeekdayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { configApi, type DeliverySlot } from '../configuration/api'
import { productApi, type ProductSummary } from '../products/api'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, ORDER_TYPES, ORDER_TYPE_LABELS, PAYMENT_LABELS, orderAdminApi, orderType, type AdminOrder, type OrderListResult, type OrderStatus, type OrderType } from './api'
import { OrderTypeTag } from './OrderTypeTag'

const PAGE_SIZE = 30
const FILTERS = { status: ORDER_STATUSES, date: 'free', slotId: 'free', source: ORDER_TYPES, productId: 'free', payment: ['credit', 'online'] } as const
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: OrderListResult }

/** The delivery slot and date of an order, or "Courier" for a shipped one. */
export const deliveryText = (order: AdminOrder): string => (order.slot ? `${formatDisplayDate(order.deliveryDate)} · ${order.slot.name} ${formatTime12h(order.slot.startTime)}–${formatTime12h(order.slot.endTime)}` : 'Courier')

/** Just the window, for a list that already shows one day. */
const windowText = (order: AdminOrder): string => (order.slot ? `${order.slot.name} · ${formatTime12h(order.slot.startTime)}` : 'Courier')

/**
 * The orders of one delivery day (today unless another day is picked), counted by type, read as a route: by window, then PIN.
 * A search looks through every day, so an old order can still be found.
 */
export function OrderList() {
  const { search, page, filters, update, clear } = useUrlListState(FILTERS)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [products, setProducts] = useState<ProductSummary[]>([])
  const today = todayInBusinessZone()
  const day = isIsoDate(filters.date) ? filters.date : today
  const searching = search.trim() !== ''
  const [moreOpen, setMoreOpen] = useState(Boolean(filters.productId || filters.payment))

  // The pick-lists are small and optional: the page works without them.
  useEffect(() => {
    let cancelled = false
    configApi['delivery-slots'].all().then(rows => { if (!cancelled) setSlots(rows) }, () => undefined)
    productApi.list({ search: '', status: '', categoryId: '', page: 1, pageSize: 100 }).then(result => { if (!cancelled) setProducts(result.rows) }, () => undefined)
    return () => { cancelled = true }
  }, [])

  // An answer that arrives after a newer request is ignored.
  useEffect(() => {
    let cancelled = false
    orderAdminApi.list({ search, status: filters.status as OrderStatus | '', date: searching ? '' : day, slotId: filters.slotId, source: filters.source as OrderType | '', productId: filters.productId, payment: filters.payment as 'credit' | 'online' | '', page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, searching, filters.status, day, filters.slotId, filters.source, filters.productId, filters.payment, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Orders could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div>

  const { rows, total, counts, typeCounts } = state.result
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dayTotal = ORDER_TYPES.reduce((sum, type) => sum + typeCounts[type], 0)
  const statusTotal = ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0)
  const dayName = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : day === addDays(today, -1) ? 'Yesterday' : formatWeekdayDate(day)
  const narrowed = Boolean(filters.status || filters.slotId || filters.source || filters.productId || filters.payment)
  const dayChip = (label: string, value: string) => <button type="button" className={`day-chip${!searching && day === value ? ' is-active' : ''}`} aria-pressed={!searching && day === value} onClick={() => update({ date: value === today ? null : value, search: null })}>{label}</button>
  const typeTab = (type: OrderType | '', label: string, count: number) => <button type="button" key={type || 'all'} className={`type-tab${filters.source === type ? ' is-active' : ''}${type ? ` type-tab-${type}` : ''}`} aria-pressed={filters.source === type} onClick={() => update({ source: type || null })}><span>{label}</span><strong>{count}</strong></button>

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Orders' }]} /><h1>Orders</h1><p className="page-description">What has to be delivered on a day. Subscription and trial deliveries show up here as normal orders, one row each.</p></div>
      <div className="header-actions"><Button asChild className="primary-button"><Link href={`/deliveries${day === today ? '' : `?date=${day}`}`}><PackageCheck size={16} /> Mark deliveries</Link></Button></div>
    </header>
    <section className="product-list-section">
      <div className="day-chip-row" role="group" aria-label="Delivery day">
        {dayChip('Yesterday', addDays(today, -1))}
        {dayChip('Today', today)}
        {dayChip('Tomorrow', addDays(today, 1))}
        <DatePickerField label="Another day" value={searching ? '' : day} onChange={value => update({ date: value === today ? null : value, search: null })} placeholder="Pick a day" />
      </div>

      <div className="order-day-summary">
        <p className="order-day-title">{searching ? <>Search results from <strong>every day</strong></> : <><strong>{dayName}</strong>{dayName !== formatWeekdayDate(day) ? <span> · {formatWeekdayDate(day)}</span> : null}</>}</p>
        <div className="type-tabs" role="group" aria-label="Order type">
          {typeTab('', searching ? 'All found' : 'All orders', dayTotal)}
          {ORDER_TYPES.map(type => typeTab(type, ORDER_TYPE_LABELS[type], typeCounts[type]))}
        </div>
      </div>

      <div className="product-filter-row">
        <ListSearchInput label="Search orders" value={search} onCommit={value => update({ search: value })} placeholder="Find any order: number, name, phone or PIN" />
        <SelectField label="Status" className="product-select-trigger" value={filters.status || ALL} onChange={value => update({ status: value === ALL ? null : value })} placeholder="Any status" options={[{ value: ALL, label: `Any status (${statusTotal})` }, ...ORDER_STATUSES.map(status => ({ value: status, label: `${ORDER_STATUS_LABELS[status]} (${counts[status]})` }))]} />
        <SelectField label="Window" className="product-select-trigger" value={filters.slotId || ALL} onChange={value => update({ slotId: value === ALL ? null : value })} placeholder="All windows" options={[{ value: ALL, label: 'All windows' }, ...slots.map(slot => ({ value: slot.id, label: `${slot.name} (${formatTime12h(slot.startTime)})` }))]} />
        <Button className="secondary-button" variant="outline" aria-expanded={moreOpen} onClick={() => setMoreOpen(value => !value)}><SlidersHorizontal size={14} /> More filters</Button>
        {narrowed || searching ? <Button className="secondary-button" variant="ghost" onClick={clear}>Clear</Button> : null}
      </div>
      {moreOpen ? <div className="product-filter-row">
        <SelectField label="Product" className="product-select-trigger" value={filters.productId || ALL} onChange={value => update({ productId: value === ALL ? null : value })} placeholder="All products" options={[{ value: ALL, label: 'All products' }, ...products.map(product => ({ value: product.id, label: product.name }))]} />
        <SelectField label="Payment" className="product-select-trigger" value={filters.payment || ALL} onChange={value => update({ payment: value === ALL ? null : value })} placeholder="Online and credit" options={[{ value: ALL, label: 'Online and credit' }, { value: 'online', label: PAYMENT_LABELS.online }, { value: 'credit', label: PAYMENT_LABELS.credit }]} />
      </div> : null}

      {total === 0
        ? <div className="product-state"><strong>{searching ? 'No order matches this search' : narrowed ? 'No orders match these filters' : `No orders for ${dayName.toLowerCase() === 'today' ? 'today' : formatWeekdayDate(day)}`}</strong><span>{searching || narrowed ? 'Try fewer filters, or clear them.' : 'Orders appear here when customers order in the app. Subscription days appear up to three days ahead.'}</span>{searching || narrowed ? <Button className="secondary-button" variant="outline" onClick={clear}>Clear</Button> : null}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table order-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>What</TableHead><TableHead>{searching ? 'Delivery' : 'Window'}</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map(order => <TableRow key={order.id}>
              <TableCell><Link className="product-name-link" href={`/orders/${order.id}`}>{order.customerName.trim() || order.recipientName || 'No name'}</Link><br /><small>{order.orderNumber} · PIN {order.pinCode}</small></TableCell>
              <TableCell>{order.items.map(item => `${item.productName} ${item.variantName} × ${item.quantity}`).join(', ')}</TableCell>
              <TableCell>{searching ? deliveryText(order) : windowText(order)}</TableCell>
              <TableCell><OrderTypeTag type={orderType(order)} /></TableCell>
              <TableCell><StatusBadge status={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{total} {total === 1 ? 'order' : 'orders'}{pageCount > 1 ? ` · Page ${page} of ${pageCount}` : ''}</span>{pageCount > 1 ? <TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /> : null}</div>
        </>}
    </section>
  </div>
}
