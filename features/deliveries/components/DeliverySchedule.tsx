'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { TablePagination } from '@/components/shared/TablePagination'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { DateQuickPicker } from '@/components/shared/DateQuickPicker'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatWeekdayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { deliverySlotService } from '../../configuration/mock-store'
import { productService } from '../../products/service'
import { deliveryService } from '../service'
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from '../types'
import { DeliveryTable } from './DeliveryTable'

const PAGE_SIZE = 20
const ALL = '__all__'
const FILTERS = { date: 'free', slot: 'free', status: ['scheduled', 'delivered', 'skipped', 'cancelled', 'not_delivered'], product: 'free' } as const

export function DeliverySchedule() {
  const { search, page, filters, update } = useUrlListState(FILTERS)
  const [revision, setRevision] = useState(0)
  const date = isIsoDate(filters.date) ? filters.date : todayInBusinessZone()
  const slots = useMemo(() => deliverySlotService.list(), [])
  const products = useMemo(() => productService.list(), [])
  const result = useMemo(() => {
    void revision
    return deliveryService.list({ date, slotId: filters.slot, status: filters.status as DeliveryStatus | '', productId: filters.product, search, page, pageSize: PAGE_SIZE })
  }, [date, filters.slot, filters.status, filters.product, search, page, revision])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const hasFilters = Boolean(filters.slot || filters.status || filters.product || search)
  const { summary } = result
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })
  const metrics = [
    { label: 'Total Deliveries', value: summary.total },
    ...summary.bySlot.map(slot => ({ label: slot.slotName, value: slot.count })),
    { label: 'Delivered', value: summary.delivered },
    { label: 'Remaining', value: summary.remaining },
  ]

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Operations' }, { label: 'Deliveries' }]} /><h1>Delivery Schedule</h1><p className="page-description">Manage scheduled customer deliveries by date and delivery slot.</p></div>
    </header>
    <section className="product-list-section">
      <div className="delivery-toolbar">
        <DateQuickPicker label="Delivery date" value={date} onChange={value => update({ date: value === todayInBusinessZone() ? null : value })} />
        <p className="delivery-date-label"><CalendarDays size={15} aria-hidden="true" />{formatWeekdayDate(date)}</p>
      </div>
      <dl className="delivery-metrics" aria-label="Summary for the selected date">{metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
      <ListSearchInput label="Search deliveries" value={search} onCommit={value => update({ search: value })} placeholder="Search by customer, mobile, product, or PIN..." />
      <div className="product-filter-row">
        <SelectField label="Delivery slot" className="product-select-trigger" value={filters.slot} onChange={set('slot')} placeholder="All slots" options={[{ value: ALL, label: 'All slots' }, ...slots.map(slot => ({ value: slot.id, label: slot.status === 'active' ? slot.name : `${slot.name} · Inactive` }))]} />
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map(value => ({ value, label: DELIVERY_STATUS_LABELS[value] }))]} />
        <SelectField label="Product" className="product-select-trigger" value={filters.product} onChange={set('product')} placeholder="All products" options={[{ value: ALL, label: 'All products' }, ...products.map(product => ({ value: product.id, label: product.name }))]} />
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{hasFilters ? 'No deliveries match these filters' : `No deliveries on ${formatWeekdayDate(date)}`}</strong><span>{hasFilters ? 'Try changing your search or filters.' : 'Deliveries are created from active subscriptions for the next 14 days.'}</span>{hasFilters ? <Button className="secondary-button" variant="outline" onClick={() => update({ search: null, slot: null, status: null, product: null })}>Clear filters</Button> : <Link className="secondary-button" href="/subscriptions">View subscriptions</Link>}</div>
        : <>
          <DeliveryTable rows={result.rows} onChanged={() => setRevision(value => value + 1)} />
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'delivery' : 'deliveries'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
        </>}
    </section>
  </div>
}
