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
import { tc } from '@/lib/i18n/common'
import { addDays, formatDisplayDate, formatTime12h, formatWeekdayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { configApi, type DeliverySlot } from '../configuration/api'
import { productApi, type ProductSummary } from '../products/api'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, ORDER_TYPES, ORDER_TYPE_LABELS, PAYMENT_LABELS, orderAdminApi, orderType, type AdminOrder, type OrderListResult, type OrderStatus, type OrderType } from './api'
import { OrderTypeTag } from './OrderTypeTag'
import { t } from './messages'

const PAGE_SIZE = 30
const FILTERS = { status: ORDER_STATUSES, date: 'free', slotId: 'free', source: ORDER_TYPES, productId: 'free', payment: ['credit', 'online'] } as const
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; result: OrderListResult }

/** The delivery slot and date of an order, or "Courier" for a shipped one. */
export const deliveryText = (order: AdminOrder): string => (order.slot ? `${formatDisplayDate(order.deliveryDate)} · ${order.slot.name} ${formatTime12h(order.slot.startTime)}–${formatTime12h(order.slot.endTime)}` : t('courier'))

/** Just the window, for a list that already shows one day. */
const windowText = (order: AdminOrder): string => (order.slot ? `${order.slot.name} · ${formatTime12h(order.slot.startTime)}` : t('courier'))

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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div>

  const { rows, total, counts, typeCounts } = state.result
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dayTotal = ORDER_TYPES.reduce((sum, type) => sum + typeCounts[type], 0)
  const statusTotal = ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0)
  const dayName = day === today ? tc('today') : day === addDays(today, 1) ? tc('tomorrow') : day === addDays(today, -1) ? tc('yesterday') : formatWeekdayDate(day)
  const narrowed = Boolean(filters.status || filters.slotId || filters.source || filters.productId || filters.payment)
  const dayChip = (label: string, value: string) => <button type="button" className={`day-chip${!searching && day === value ? ' is-active' : ''}`} aria-pressed={!searching && day === value} onClick={() => update({ date: value === today ? null : value, search: null })}>{label}</button>
  const typeTab = (type: OrderType | '', label: string, count: number) => <button type="button" key={type || 'all'} className={`type-tab${filters.source === type ? ' is-active' : ''}${type ? ` type-tab-${type}` : ''}`} aria-pressed={filters.source === type} onClick={() => update({ source: type || null })}><span>{label}</span><strong>{count}</strong></button>

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('orders') }]} /><h1>{t('orders')}</h1><p className="page-description">{t('listDescription')}</p></div>
      <div className="header-actions"><Button asChild className="primary-button"><Link href={`/deliveries${day === today ? '' : `?date=${day}`}`}><PackageCheck size={16} /> {t('markDeliveries')}</Link></Button></div>
    </header>
    <section className="product-list-section">
      <div className="day-chip-row" role="group" aria-label={tc('deliveryDay')}>
        {dayChip(tc('yesterday'), addDays(today, -1))}
        {dayChip(tc('today'), today)}
        {dayChip(tc('tomorrow'), addDays(today, 1))}
        <DatePickerField label={t('anotherDay')} value={searching ? '' : day} onChange={value => update({ date: value === today ? null : value, search: null })} placeholder={t('pickADay')} />
      </div>

      <div className="order-day-summary">
        <p className="order-day-title">{searching ? <>{t('searchResultsFrom')} <strong>{t('everyDay')}</strong></> : <><strong>{dayName}</strong>{dayName !== formatWeekdayDate(day) ? <span> · {formatWeekdayDate(day)}</span> : null}</>}</p>
        <div className="type-tabs" role="group" aria-label={t('orderType')}>
          {typeTab('', searching ? t('allFound') : t('allOrders'), dayTotal)}
          {ORDER_TYPES.map(type => typeTab(type, ORDER_TYPE_LABELS[type], typeCounts[type]))}
        </div>
      </div>

      <div className="product-filter-row">
        <ListSearchInput label={t('searchOrders')} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
        <SelectField label={t('status')} className="product-select-trigger" value={filters.status || ALL} onChange={value => update({ status: value === ALL ? null : value })} placeholder={t('anyStatus')} options={[{ value: ALL, label: t('anyStatusCount', { count: statusTotal }) }, ...ORDER_STATUSES.map(status => ({ value: status, label: `${ORDER_STATUS_LABELS[status]} (${counts[status]})` }))]} />
        <SelectField label={t('window')} className="product-select-trigger" value={filters.slotId || ALL} onChange={value => update({ slotId: value === ALL ? null : value })} placeholder={t('allWindows')} options={[{ value: ALL, label: t('allWindows') }, ...slots.map(slot => ({ value: slot.id, label: `${slot.name} (${formatTime12h(slot.startTime)})` }))]} />
        <Button className="secondary-button" variant="outline" aria-expanded={moreOpen} onClick={() => setMoreOpen(value => !value)}><SlidersHorizontal size={14} /> {t('moreFilters')}</Button>
        {narrowed || searching ? <Button className="secondary-button" variant="ghost" onClick={clear}>{t('clear')}</Button> : null}
      </div>
      {moreOpen ? <div className="product-filter-row">
        <SelectField label={t('product')} className="product-select-trigger" value={filters.productId || ALL} onChange={value => update({ productId: value === ALL ? null : value })} placeholder={t('allProducts')} options={[{ value: ALL, label: t('allProducts') }, ...products.map(product => ({ value: product.id, label: product.name }))]} />
        <SelectField label={t('payment')} className="product-select-trigger" value={filters.payment || ALL} onChange={value => update({ payment: value === ALL ? null : value })} placeholder={t('onlineAndCredit')} options={[{ value: ALL, label: t('onlineAndCredit') }, { value: 'online', label: PAYMENT_LABELS.online }, { value: 'credit', label: PAYMENT_LABELS.credit }]} />
      </div> : null}

      {total === 0
        ? <div className="product-state"><strong>{searching ? t('noSearchMatch') : narrowed ? t('noFilterMatch') : day === today ? t('noOrdersToday') : t('noOrdersOn', { day: formatWeekdayDate(day) })}</strong><span>{searching || narrowed ? t('tryFewerFilters') : t('ordersAppear')}</span>{searching || narrowed ? <Button className="secondary-button" variant="outline" onClick={clear}>{t('clear')}</Button> : null}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table order-table">
            <TableHeader><TableRow><TableHead>{t('customer')}</TableHead><TableHead>{t('what')}</TableHead><TableHead>{searching ? t('delivery') : t('window')}</TableHead><TableHead>{t('type')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map(order => <TableRow key={order.id}>
              <TableCell><Link className="product-name-link" href={`/orders/${order.id}`}>{order.customerName.trim() || order.recipientName || t('noName')}</Link><br /><small>{order.orderNumber} · {t('pin', { pin: order.pinCode })}</small></TableCell>
              <TableCell>{order.items.map(item => `${item.productName} ${item.variantName} × ${item.quantity}`).join(', ')}</TableCell>
              <TableCell>{searching ? deliveryText(order) : windowText(order)}</TableCell>
              <TableCell><OrderTypeTag type={orderType(order)} /></TableCell>
              <TableCell><StatusBadge status={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(total === 1 ? 'orderCountOne' : 'orderCountMany', { count: total })}{pageCount > 1 ? t('pageOf', { page, count: pageCount }) : ''}</span>{pageCount > 1 ? <TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /> : null}</div>
        </>}
    </section>
  </div>
}
