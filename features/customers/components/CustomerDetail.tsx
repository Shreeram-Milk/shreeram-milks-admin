'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DetailRows } from '@/components/shared/DetailRows'
import { formatINR } from '@/lib/money'
import { formatDisplayDate, formatTimestamp, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { nextDeliveryLabel } from '../../subscriptions/next-delivery'
import { describeSchedule } from '../../subscriptions/schedule'
import { subscriptionService } from '../../subscriptions/service'
import { SubscriptionStatusBadge } from '../../subscriptions/components/SubscriptionStatusBadge'
import { formatAddress, getPrimaryAddress } from '../address'
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge'
import { orderService } from '../../orders/service'
import { TrialStatusBadge } from '../../trials/components/TrialStatusBadge'
import { trialService } from '../../trials/service'
import { DeliveryHistoryTable } from '../../deliveries/components/DeliveryHistoryTable'
import { deliveryService } from '../../deliveries/service'
import { customerService } from '../service'
import { CustomerAccountTab } from './CustomerAccountTab'
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TYPE_LABELS } from '../types'

const HISTORY_LIMIT = 25

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter()
  const customer = customerService.getById(id)
  if (!customer) return <div className="product-state"><strong>Customer not found</strong><Link className="secondary-button" href="/customers">Back to customers</Link></div>
  const address = getPrimaryAddress(customer)
  const subscriptions = subscriptionService.listForCustomer(id)
  const orders = orderService.listForCustomer(id)
  const trials = trialService.listForCustomer(id)
  const customerDeliveries = deliveryService.getByCustomer(id)
  const today = todayInBusinessZone()
  const upcomingDeliveries = customerDeliveries.filter(item => item.delivery.status === 'scheduled' && item.delivery.deliveryDate >= today).reverse().slice(0, 3)
  const pastDeliveries = customerDeliveries.filter(item => !(item.delivery.status === 'scheduled' && item.delivery.deliveryDate >= today)).slice(0, HISTORY_LIMIT)
  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to customers" onClick={() => router.push('/customers')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Customers', href: '/customers' }, { label: customer.fullName }]} /><h1>{customer.fullName}</h1><p className="page-description">{CUSTOMER_TYPE_LABELS[customer.customerType]} customer · {customer.mobile}</p></div>
      </div>
      <div className="header-actions">
        <StatusBadge status={customer.status}>{CUSTOMER_STATUS_LABELS[customer.status]}</StatusBadge>
        <Link className="secondary-button" href={`/customers/${id}/edit`}><Edit2 size={15} /> Edit Customer</Link>
        {customer.status === 'active' ? <Link className="primary-button" href={`/customers/${id}/subscriptions/new`}><Plus size={15} /> Create Subscription</Link>
          : <Button className="primary-button" disabled title="Activate the customer to create subscriptions"><Plus size={15} /> Create Subscription</Button>}
      </div>
    </header>
    <Tabs defaultValue="overview">
      <TabsList aria-label="Customer sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="subscriptions">Subscriptions ({subscriptions.length})</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="deliveries">Delivery History</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <section className="form-card customer-summary-card"><h2>Customer summary</h2>
          <DetailRows rows={[
            { label: 'Mobile', value: customer.mobile },
            { label: 'Email', value: customer.email || '—' },
            { label: 'Address', value: formatAddress(address) },
            { label: 'PIN', value: address?.pinCode ?? '—' },
            { label: 'Customer type', value: CUSTOMER_TYPE_LABELS[customer.customerType] },
            { label: 'Created', value: formatTimestamp(customer.createdAt) },
            { label: 'Updated', value: formatTimestamp(customer.updatedAt) },
            ...(customer.notes ? [{ label: 'Notes', value: customer.notes }] : []),
          ]} />
        </section>
        <section className="form-card customer-summary-card"><h2>Upcoming deliveries</h2>
          {upcomingDeliveries.length === 0 ? <p className="product-hint">No scheduled deliveries in the next 14 days.</p>
            : <ul className="breakdown-list">{upcomingDeliveries.map(({ delivery, product, variant, slot }) => <li key={delivery.id}><span><Link className="product-name-link" href={`/deliveries/${delivery.id}`}>{formatWeekdayDate(delivery.deliveryDate)}</Link> <small>{slot?.name ?? ''}</small></span><strong>{product?.name} · {variant?.name} × {delivery.quantity}</strong></li>)}</ul>}
        </section>
      </TabsContent>
      <TabsContent value="subscriptions">
        <section className="form-card"><div className="section-title-row"><h2>Subscriptions</h2>{customer.status === 'active' && <Link className="secondary-button" href={`/customers/${id}/subscriptions/new`}><Plus size={14} /> Create Subscription</Link>}</div>
          {subscriptions.length === 0 ? <div className="product-state"><strong>No subscriptions yet</strong><span>Create a subscription to schedule recurring deliveries for this customer.</span></div>
            : <div className="table-card"><Table className="config-table">
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Schedule</TableHead><TableHead>Delivery Slot</TableHead><TableHead>Next Delivery</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{subscriptions.map(view => <TableRow key={view.subscription.id}>
                <TableCell><Link className="product-name-link" href={`/subscriptions/${view.subscription.id}`}>{view.product?.name ?? 'Unavailable product'}</Link><small>{view.variant?.name}</small></TableCell>
                <TableCell>{describeSchedule(view.subscription.schedule)}</TableCell>
                <TableCell>{view.slot?.name ?? '—'}</TableCell>
                <TableCell>{nextDeliveryLabel(view)}</TableCell>
                <TableCell><SubscriptionStatusBadge status={view.status} /></TableCell>
              </TableRow>)}</TableBody>
            </Table></div>}
        </section>
        <section className="form-card"><div className="section-title-row"><h2>Trials</h2>{customer.status === 'active' && <Link className="secondary-button" href={`/trials/new?customer=${id}`}><Plus size={14} /> Start Trial</Link>}</div>
          {trials.length === 0 ? <p className="product-hint">No trials for this customer.</p>
            : <div className="table-card"><Table className="config-table"><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Plan</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{trials.map(({ trial, product, variant, status }) => <TableRow key={trial.id}><TableCell><Link className="product-name-link" href={`/trials/${trial.id}`}>{product?.name ?? 'Unavailable product'}</Link><small>{variant?.name}</small></TableCell><TableCell>{trial.trialPlanNameSnapshot}</TableCell><TableCell>{formatDisplayDate(trial.startDate)}</TableCell><TableCell>{formatDisplayDate(trial.endDate)}</TableCell><TableCell><TrialStatusBadge status={status} /></TableCell></TableRow>)}</TableBody></Table></div>}
        </section>
      </TabsContent>
      <TabsContent value="orders">
        <section className="form-card"><div className="section-title-row"><h2>Orders</h2>{customer.status === 'active' && <Link className="secondary-button" href={`/orders/new?customer=${id}`}><Plus size={14} /> Create Order</Link>}</div>
          {orders.length === 0 ? <div className="product-state"><strong>No orders yet</strong><span>One-time Buy Once orders for this customer appear here.</span></div>
            : <div className="table-card"><Table className="config-table"><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Delivery Date</TableHead><TableHead>Items</TableHead><TableHead className="numeric">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{orders.map(({ order, status }) => <TableRow key={order.id}><TableCell><Link className="product-name-link" href={`/orders/${order.id}`}>{order.orderNumber}</Link></TableCell><TableCell>{order.deliveryDate ? formatDisplayDate(order.deliveryDate) : '—'}</TableCell><TableCell>{order.items.map(item => `${item.productNameSnapshot} ${item.variantNameSnapshot} × ${item.quantity}`).join(', ')}</TableCell><TableCell className="numeric">{formatINR(order.totalPaise)}</TableCell><TableCell><OrderStatusBadge status={status} /></TableCell></TableRow>)}</TableBody></Table></div>}
        </section>
      </TabsContent>
      <TabsContent value="deliveries">
        <section className="form-card"><h2>Delivery history</h2>
          <p className="product-hint">Delivery records for this customer, newest first. Showing the most recent {HISTORY_LIMIT}.</p>
          <DeliveryHistoryTable rows={pastDeliveries} empty="No deliveries yet." />
        </section>
      </TabsContent>
      <TabsContent value="account"><CustomerAccountTab customer={customer} /></TabsContent>
    </Tabs>
  </div>
}
