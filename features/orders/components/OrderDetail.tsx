'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Check, Edit2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailRows } from '@/components/shared/DetailRows'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { formatDisplayDate, formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { fulfilmentProfileService } from '../../configuration/mock-store'
import { formatAddress } from '../../customers/address'
import { CUSTOMER_TYPE_LABELS } from '../../customers/types'
import { DeliveryStatusBadge } from '../../deliveries/components/DeliveryStatusBadge'
import { deliveryService } from '../../deliveries/service'
import { orderService, OrderRuleError } from '../service'
import { ORDER_TYPE_LABELS } from '../types'
import { CancelOrderDialog } from './CancelOrderDialog'
import { OrderStatusBadge } from './OrderStatusBadge'

export function OrderDetail({ id }: { id: string }) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const view = useMemo(() => { void revision; return orderService.getView(id) }, [id, revision])
  const deliveries = useMemo(() => { void revision; return deliveryService.getByOrder(id) }, [id, revision])
  if (!view) return <div className="product-state"><strong>Order not found</strong><Link className="secondary-button" href="/orders">Back to orders</Link></div>

  const { order, customer, slot, status } = view
  const profile = fulfilmentProfileService.getById(order.fulfilmentProfileId)
  const refresh = () => setRevision(value => value + 1)
  const anyDelivered = deliveries.some(item => item.delivery.status === 'delivered')
  const editable = (order.status === 'draft' || order.status === 'confirmed') && !anyDelivered
  const cancellable = (order.status === 'draft' || order.status === 'confirmed') && !anyDelivered

  const confirmOrder = () => {
    setConfirming(true)
    try { orderService.confirm(id); toast.success('Order confirmed. Its delivery is now scheduled.'); refresh() }
    catch (error) { toast.error(error instanceof OrderRuleError || error instanceof Error ? error.message : 'Unable to confirm the order.') }
    finally { setConfirming(false) }
  }

  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0)
  return <div className="workspace-page products-page order-detail">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to orders" onClick={() => router.push('/orders')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Orders', href: '/orders' }, { label: order.orderNumber }]} />
          <div className="od-title"><h1>{order.orderNumber}</h1><OrderStatusBadge status={status} /></div>
          <p className="page-description">{ORDER_TYPE_LABELS[order.orderType]} order · placed {formatTimestamp(order.createdAt)}</p></div>
      </div>
      <div className="header-actions">
        {editable && <Link className="secondary-button" href={`/orders/${id}/edit`}><Edit2 size={15} /> Edit</Link>}
        {cancellable && <Button variant="outline" className="secondary-button destructive-outline" onClick={() => setCancelling(true)}><XCircle size={15} /> Cancel</Button>}
        {order.status === 'draft' && <Button className="primary-button" disabled={confirming} onClick={confirmOrder}><Check size={15} /> Confirm Order</Button>}
      </div>
    </header>
    {order.status === 'cancelled' && order.cancellation && <p className="warning-note" role="status">Cancelled on {formatDisplayDate(order.cancellation.cancelledOn)}{order.cancellation.reason ? ` · ${order.cancellation.reason}` : ''}. This order is view-only.</p>}
    {order.status === 'draft' && <p className="warning-note" role="status">This order is a draft. Confirm it to schedule its delivery.</p>}

    <div className="od-layout">
      <div className="od-main">
        <section className="panel" aria-labelledby="order-items-title">
          <header className="panel-header"><div><h2 id="order-items-title">Items</h2><p>{itemCount} {itemCount === 1 ? 'unit' : 'units'} · prices fixed when the order was saved</p></div></header>
          <div className="od-items">
            <ul className="od-item-list">{order.items.map(item => <li key={item.id}>
              <div className="od-item-name"><strong>{item.productNameSnapshot}</strong><span>{item.variantNameSnapshot}{item.skuSnapshot ? ` · ${item.skuSnapshot}` : ''}</span></div>
              <span className="od-item-calc">{formatINR(item.unitPricePaiseSnapshot)} × {item.quantity}</span>
              <strong className="od-item-total">{formatINR(item.lineTotalPaise)}</strong>
            </li>)}</ul>
            <dl className="order-totals"><div><dt>Subtotal</dt><dd>{formatINR(order.subtotalPaise)}</dd></div>{order.adjustmentPaise !== 0 && <div><dt>Adjustment</dt><dd>{formatINR(order.adjustmentPaise)}</dd></div>}<div className="grand"><dt>Total</dt><dd>{formatINR(order.totalPaise)}</dd></div></dl>
          </div>
        </section>

        <section className="panel" aria-labelledby="order-deliveries-title">
          <header className="panel-header"><div><h2 id="order-deliveries-title">Deliveries</h2><p>Created from this order</p></div></header>
          {deliveries.length === 0 ? <p className="od-empty">{order.status === 'draft' ? 'No delivery yet — it is created when the order is confirmed.' : 'No delivery records.'}</p>
            : <ul className="od-delivery-list">{deliveries.map(({ delivery, product, variant, slot: deliverySlot }) => <li key={delivery.id}>
              <div><strong>{formatDisplayDate(delivery.deliveryDate)}</strong><span>{product?.name ?? 'Unavailable product'} · {variant?.name ?? '—'} × {delivery.quantity}{deliverySlot ? ` · ${deliverySlot.name}` : ''}</span></div>
              <DeliveryStatusBadge delivery={delivery} />
              <Link className="secondary-button delivery-action" href={`/deliveries/${delivery.id}`}>View</Link>
            </li>)}</ul>}
        </section>
      </div>

      <aside className="od-side" aria-label="Order context">
        <section className="panel"><header className="panel-header"><h2>Customer</h2></header>
          <div className="od-side-body">
            <p className="od-customer">{customer ? <Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.fullName}</Link> : 'Unknown customer'}</p>
            <p className="od-muted">{CUSTOMER_TYPE_LABELS[order.paymentMode]} customer</p>
            <p className="od-address">{formatAddress({ id: 'snapshot', ...order.addressSnapshot, isPrimary: true })}</p>
            <p className="od-muted">PIN {order.pincode}</p>
          </div>
        </section>
        <section className="panel"><header className="panel-header"><h2>Delivery</h2></header>
          <div className="od-side-body"><DetailRows rows={[
            { label: 'Date', value: order.deliveryDate ? formatDisplayDate(order.deliveryDate) : '—' },
            { label: 'Slot', value: slot?.name ?? (order.deliverySlotId ? 'Unavailable slot' : 'Not applicable') },
            { label: 'Fulfilment', value: profile?.name ?? '—' },
          ]} /></div>
        </section>
        <p className="od-meta">Last updated {formatTimestamp(order.updatedAt)}</p>
      </aside>
    </div>
    <CancelOrderDialog orderId={id} orderNumber={order.orderNumber} hasDelivery={deliveries.some(item => item.delivery.status === 'scheduled')} open={cancelling} onOpenChange={setCancelling} onDone={refresh} />
  </div>
}
