'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailRows } from '@/components/shared/DetailRows'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { formatTimestamp, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { formatAddress } from '../../customers/address'
import { CUSTOMER_TYPE_LABELS } from '../../customers/types'
import { deliveryService } from '../service'
import { CANCELLATION_REASON_LABELS, DELIVERY_SOURCE_LABELS, NOT_DELIVERED_REASON_LABELS } from '../types'
import { DeliveryFinancialStatus } from './DeliveryFinancialStatus'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { MarkDeliveredButton } from './MarkDeliveredButton'
import { MarkNotDeliveredDialog } from './MarkNotDeliveredDialog'
import { ServiceabilityWarning } from './ServiceabilityWarning'

const inactive = (flag: boolean, text: string) => flag ? `${text} · Inactive` : text

export function DeliveryDetail({ id }: { id: string }) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [rejecting, setRejecting] = useState(false)
  const view = useMemo(() => { void revision; return deliveryService.getById(id) }, [id, revision])
  if (!view) return <div className="product-state"><strong>Delivery not found</strong><Link className="secondary-button" href="/deliveries">Back to deliveries</Link></div>

  const { delivery, customer, product, variant, slot, profile, area } = view
  const name = customer?.fullName ?? 'Unknown customer'
  const snapshot = delivery.customerAddressSnapshot
  const actionable = delivery.status === 'scheduled'
  const future = delivery.deliveryDate > todayInBusinessZone()
  const refresh = () => setRevision(value => value + 1)

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to deliveries" onClick={() => router.push(`/deliveries?date=${delivery.deliveryDate}`)}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Deliveries', href: `/deliveries?date=${delivery.deliveryDate}` }, { label: name }]} /><h1>{name}</h1><p className="page-description">{product?.name ?? 'Unavailable product'} · {formatWeekdayDate(delivery.deliveryDate)}</p></div>
      </div>
      <div className="header-actions">
        <DeliveryStatusBadge delivery={delivery} />
        {actionable && <MarkDeliveredButton deliveryId={delivery.id} disabledReason={future ? 'Available on the delivery date' : undefined} onDone={refresh} />}
        {actionable && <Button type="button" variant="outline" className="secondary-button" disabled={future} title={future ? 'Available on the delivery date' : undefined} onClick={() => setRejecting(true)}><XCircle size={15} /> Mark Not Delivered</Button>}
      </div>
    </header>
    {view.warning && <ServiceabilityWarning message={view.warning} />}
    <div className="product-detail-grid">
      <section className="form-card"><h2>Delivery</h2>
        <DetailRows rows={[
          { label: 'Delivery date', value: formatWeekdayDate(delivery.deliveryDate) },
          { label: 'Delivery slot', value: slot ? inactive(view.inactive.slot, slot.name) : delivery.deliverySlotId ? 'Unavailable slot' : 'Not applicable' },
          { label: 'Product', value: product ? inactive(view.inactive.product, product.name) : 'Unavailable product' },
          { label: 'Variant', value: variant ? inactive(view.inactive.variant, variant.name) : '—' },
          { label: 'Quantity', value: String(delivery.quantity) },
          { label: 'Source', value: DELIVERY_SOURCE_LABELS[delivery.sourceType] },
          { label: 'Source record', value: delivery.subscriptionId ? <Link className="product-name-link" href={`/subscriptions/${delivery.subscriptionId}`}>View subscription</Link> : delivery.orderId ? <Link className="product-name-link" href={`/orders/${delivery.orderId}`}>View order</Link> : delivery.trialEnrollmentId ? <Link className="product-name-link" href={`/trials/${delivery.trialEnrollmentId}`}>View trial</Link> : '—' },
          { label: 'Fulfilment profile', value: profile ? inactive(view.inactive.profile, profile.name) : '—' },
          { label: 'Service area', value: area ? inactive(view.inactive.area, area.name) : '—' },
        ]} />
      </section>
      <section className="form-card"><h2>Customer &amp; address</h2>
        <DetailRows rows={[
          { label: 'Customer', value: customer ? <Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.fullName}</Link> : '—' },
          { label: 'Mobile', value: customer?.mobile ?? '—' },
          { label: 'Customer type', value: customer ? CUSTOMER_TYPE_LABELS[customer.customerType] : '—' },
          { label: 'Delivery address', value: formatAddress({ id: 'snapshot', ...snapshot, isPrimary: true }) },
          { label: 'PIN', value: delivery.customerPincode },
        ]} />
        <p className="product-hint">The address is a snapshot taken when this delivery was created; later customer address edits don’t change it.</p>
      </section>
      <DeliveryFinancialStatus delivery={delivery} customer={customer} />
      <section className="form-card"><h2>Status &amp; notes</h2>
        <DetailRows rows={[
          { label: 'Status', value: <DeliveryStatusBadge delivery={delivery} /> },
          ...(delivery.deliveredAt ? [{ label: 'Delivered at', value: formatTimestamp(delivery.deliveredAt) }] : []),
          ...(delivery.notDeliveredReason ? [{ label: 'Not delivered because', value: NOT_DELIVERED_REASON_LABELS[delivery.notDeliveredReason] }] : []),
          ...(delivery.skipReason ? [{ label: 'Skip reason', value: delivery.skipReason }] : []),
          ...(delivery.cancellationReason ? [{ label: 'Cancelled because', value: CANCELLATION_REASON_LABELS[delivery.cancellationReason] }] : []),
          { label: 'Operational notes', value: delivery.adminNotes || '—' },
          { label: 'Created', value: formatTimestamp(delivery.createdAt) },
          { label: 'Updated', value: formatTimestamp(delivery.updatedAt) },
        ]} />
        {delivery.status === 'not_delivered' && <p className="help-text">Financial handling for undelivered prepaid deliveries will be resolved separately.</p>}
      </section>
    </div>
    {rejecting && <MarkNotDeliveredDialog deliveryId={delivery.id} customerName={name} open onOpenChange={open => { if (!open) setRejecting(false) }} onDone={refresh} />}
  </div>
}
