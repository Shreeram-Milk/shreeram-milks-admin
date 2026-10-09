'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Edit2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SelectField } from '@/components/ui/select-field'
import { TablePagination } from '@/components/shared/TablePagination'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { useUrlListState } from '@/hooks/useUrlListState'
import { nextDeliveryLabel } from '../next-delivery'
import { deliverySlotService } from '../../configuration/mock-store'
import { productService } from '../../products/service'
import { describeSchedule } from '../schedule'
import { subscriptionService } from '../service'
import { SCHEDULE_TYPE_LABELS, SUBSCRIPTION_STATUS_LABELS, type ScheduleType, type SubscriptionStatus } from '../types'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'

const PAGE_SIZE = 8
const ALL = '__all__'
const FILTERS = { status: ['active', 'paused', 'cancelled', 'upcoming'], productId: 'free', scheduleType: ['daily', 'alternate_days', 'custom_weekdays'], slotId: 'free' } as const

export function SubscriptionList() {
  const { search, page, filters, update, clear, hasActiveFilters } = useUrlListState(FILTERS)
  const products = useMemo(() => productService.list().filter(product => product.purchaseMethods.includes('subscription')), [])
  const slots = useMemo(() => deliverySlotService.list(), [])
  const result = useMemo(() => subscriptionService.list({ search, status: filters.status as SubscriptionStatus | '', productId: filters.productId, scheduleType: filters.scheduleType as ScheduleType | '', slotId: filters.slotId, page, pageSize: PAGE_SIZE }), [search, filters.status, filters.productId, filters.scheduleType, filters.slotId, page])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><h1>Subscriptions</h1><p className="page-description">Manage recurring dairy deliveries and customer schedules.</p></div>
      <Link className="primary-button" href="/subscriptions/new"><Plus size={15} /> Create Subscription</Link>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search subscriptions" value={search} onCommit={value => update({ search: value })} placeholder="Search by customer, mobile, or product..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map(value => ({ value, label: SUBSCRIPTION_STATUS_LABELS[value] }))]} />
        <SelectField label="Product" className="product-select-trigger" value={filters.productId} onChange={set('productId')} placeholder="All products" options={[{ value: ALL, label: 'All products' }, ...products.map(product => ({ value: product.id, label: product.name }))]} />
        <SelectField label="Schedule type" className="product-select-trigger" value={filters.scheduleType} onChange={set('scheduleType')} placeholder="All schedules" options={[{ value: ALL, label: 'All schedules' }, ...(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map(value => ({ value, label: SCHEDULE_TYPE_LABELS[value] }))]} />
        <SelectField label="Delivery slot" className="product-select-trigger" value={filters.slotId} onChange={set('slotId')} placeholder="All slots" options={[{ value: ALL, label: 'All slots' }, ...slots.map(slot => ({ value: slot.id, label: slot.name }))]} />
      </div>
      {!hasActiveFilters && result.total === 0 ? <div className="product-state"><strong>No subscriptions yet</strong><span>Create a subscription to schedule recurring deliveries.</span><Link className="primary-button" href="/subscriptions/new"><Plus size={14} /> Create Subscription</Link></div>
        : result.total === 0 ? <div className="product-state"><strong>No subscriptions match these filters</strong><span>Try changing your search or filters.</span><Button className="secondary-button" variant="outline" onClick={clear}>Clear filters</Button></div>
          : <>
            <div className="table-card product-list-table-card"><Table className="config-table subscription-table">
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Variant</TableHead><TableHead>Schedule</TableHead><TableHead>Delivery Slot</TableHead><TableHead>Next Delivery</TableHead><TableHead>Status</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{result.rows.map(view => <TableRow key={view.subscription.id}>
                <TableCell><span className="identity-cell"><InitialsAvatar name={view.customer?.fullName ?? '?'} /><Link className="product-name-link" href={`/subscriptions/${view.subscription.id}`}>{view.customer?.fullName ?? 'Unknown customer'}</Link></span></TableCell>
                <TableCell>{view.product?.name ?? 'Unavailable product'}</TableCell>
                <TableCell>{view.variant?.name ?? '—'}</TableCell>
                <TableCell>{describeSchedule(view.subscription.schedule)}</TableCell>
                <TableCell>{view.slot?.name ?? '—'}</TableCell>
                <TableCell>{nextDeliveryLabel(view)}</TableCell>
                <TableCell><SubscriptionStatusBadge status={view.status} /></TableCell>
                <TableCell><div className="row-actions product-row-actions">{view.status !== 'cancelled' && <Link href={`/subscriptions/${view.subscription.id}/edit`} className="row-edit-action" aria-label={`Edit subscription for ${view.customer?.fullName ?? 'customer'}`}><Edit2 size={15} /></Link>}</div></TableCell>
              </TableRow>)}</TableBody>
            </Table></div>
            <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'subscription' : 'subscriptions'} · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
          </>}
    </section>
  </div>
}
