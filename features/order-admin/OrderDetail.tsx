'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { NEXT_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PAYMENT_LABELS, orderAdminApi, type AdminOrder, type OrderStatus } from './api'
import { deliveryText } from './OrderList'
import { bankReferenceLabel, describeMethod } from '../payment-admin/api'

type Step = Exclude<OrderStatus, 'placed'>
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; order: AdminOrder }

const BUTTON_LABELS: Record<Step, string> = { out_for_delivery: 'Mark out for delivery', delivered: 'Mark delivered', missed: 'Mark missed', cancelled: 'Cancel order' }

/** What a step does to the customer's money, in plain words, for the confirmation. */
function consequence(order: AdminOrder, step: Step): string {
  if (step === 'out_for_delivery') return 'The customer can no longer cancel this order. Nothing changes about the payment.'
  if (step === 'delivered') return 'This is final. The order is done and cannot be changed afterwards.'
  if (step === 'missed') return 'The order is marked missed. It is final. No money is returned by itself: if the customer should get it back, use "Return money" afterwards.'
  if (order.subscriptionId) return 'The order is cancelled. It is final. This is a subscription delivery, so it moves to the end of the subscription: the customer still gets every delivery they bought.' + (order.paymentMethod === 'credit' ? ` ${formatINR(order.totalPaise)} is taken off what the customer owes, and charged again with the later delivery.` : '')
  return order.paymentMethod === 'credit'
    ? `The order is cancelled. It is final, and ${formatINR(order.totalPaise)} is taken off what the customer owes.`
    : `The order is cancelled. It is final. The customer paid ${formatINR(order.totalPaise)} online: a "refund pending" item appears in Money → Owed to customers for you to refund in PhonePe and record.`
}

/** Missed or delivered, paid or charged, and not returned yet: staff may decide to give the money back. */
const canReturnMoney = (order: AdminOrder) => (order.status === 'missed' || order.status === 'delivered') && !order.moneyReturnedAt && (order.paymentMethod === 'credit' || order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded')

/** One order: what was bought, where and when, the money, and the steps staff can take (each confirmed, because some are final). */
export function OrderDetail({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [pending, setPending] = useState<Step | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnReason, setReturnReason] = useState('')

  useEffect(() => {
    let cancelled = false
    orderAdminApi.get(id).then(
      order => { if (!cancelled) setState({ status: 'ready', order }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [id, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>The order could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button><Link className="secondary-button" href="/orders">Back to orders</Link></div>

  const { order } = state
  const steps = NEXT_STATUSES[order.status]
  const apply = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const updated = await orderAdminApi.setStatus(order.id, pending, note)
      setState({ status: 'ready', order: updated })
      toast.success(`${order.orderNumber} is now ${ORDER_STATUS_LABELS[pending].toLowerCase()}.`)
      setPending(null)
      setNote('')
    } catch (failure) { toast.error(describeApiError(failure)); setPending(null) }
    setBusy(false)
  }
  const returnMoney = async () => {
    setBusy(true)
    try {
      const updated = await orderAdminApi.returnMoney(order.id, returnReason.trim())
      setState({ status: 'ready', order: updated })
      toast.success(order.paymentMethod === 'credit' ? `${formatINR(order.totalPaise)} taken off what the customer owes.` : 'Added to Money → Owed to customers, as a refund to send.')
      setReturning(false)
      setReturnReason('')
    } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href="/orders" aria-label="Back to orders"><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: 'Orders', href: '/orders' }, { label: order.orderNumber }]} /><h1>{order.orderNumber}</h1><p className="page-description">Placed {formatTimestamp(order.placedAt)} by <Link className="product-name-link" href={`/customers/${order.customerId}`}>{order.customerName.trim() || 'a customer'}</Link>.</p></div>
      </div>
      <div className="header-actions">
        <StatusBadge status={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
        {steps.map(step => <Button key={step} className={step === 'cancelled' || step === 'missed' ? 'secondary-button' : 'primary-button'} onClick={() => setPending(step)}>{BUTTON_LABELS[step]}</Button>)}
        {canReturnMoney(order) ? <Button className="secondary-button" variant="outline" onClick={() => setReturning(true)}>Return money</Button> : null}
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>Delivery</h2><div className="product-detail-rows">
        <Row label="When" value={deliveryText(order)} />
        {order.orderBy && <Row label="Ordering closed at" value={formatTimestamp(order.orderBy)} />}
        <Row label="Recipient" value={`${order.recipientName} · ${order.recipientPhone}`} />
        <Row label="Address" value={[order.addressLine1, order.addressLine2, order.landmark, order.city].filter(Boolean).join(', ') + ` – ${order.pinCode}`} />
        {order.doorstepNote && <Row label="Doorstep note" value={order.doorstepNote} />}
        {order.subscriptionId ? <div><span>Subscription</span><Link className="product-name-link" href={`/subscriptions/${order.subscriptionId}`}>{order.items[0]?.purchaseMethod === 'trial' ? 'One delivery of a trial' : 'One delivery of a subscription'}</Link></div> : null}
      </div></section>
      {order.deliveryMethod === 'shipping' ? <CourierCard key={`${order.courierName}|${order.trackingUrl}`} order={order} onSaved={updated => setState({ status: 'ready', order: updated })} /> : null}
      <section className="form-card"><h2>Payment</h2><div className="product-detail-rows">
        <Row label="Method" value={PAYMENT_LABELS[order.paymentMethod]} />
        <Row label="Payment status" value={order.paymentMethod === 'credit' ? 'Charged to the customer credit account' : order.paymentStatus.replaceAll('_', ' ')} />
        {order.onlinePayment ? <>
          <Row label="Paid with" value={describeMethod(order.onlinePayment.mode, order.onlinePayment.instrument, order.onlinePayment.bank)} />
          {order.onlinePayment.paidAt ? <Row label="Paid at" value={formatTimestamp(order.onlinePayment.paidAt)} /> : null}
          <Row label="PhonePe transaction ID" value={order.onlinePayment.providerTransactionId ?? '—'} />
          <Row label="PhonePe order ID" value={order.onlinePayment.providerOrderId ?? '—'} />
          <Row label="Our payment reference" value={order.onlinePayment.merchantOrderId} />
          {order.onlinePayment.bankReference ? <Row label={bankReferenceLabel(order.onlinePayment.mode)} value={order.onlinePayment.bankReference} /> : null}
          {order.onlinePayment.amountPaise !== order.totalPaise ? <Row label="Payment covered" value={`${formatINR(order.onlinePayment.amountPaise)} (this and other orders paid together)`} /> : null}
          <div><span /><Link className="product-name-link" href={`/online-payments/${order.onlinePayment.id}`}>View the full payment history</Link></div>
        </> : null}
        <Row label="Subtotal" value={formatINR(order.subtotalPaise)} />
        {order.offerTitle ? <Row label="Offer used" value={order.discountPaise > 0 ? `${order.offerTitle} (−${formatINR(order.discountPaise)})` : order.offerTitle} /> : null}
        <Row label="Total" value={formatINR(order.totalPaise)} />
        {order.moneyReturnedAt ? <Row label="Money returned" value={formatTimestamp(order.moneyReturnedAt)} /> : null}
        {order.status === 'cancelled' && <Row label="Cancelled" value={`${order.cancelledAt ? formatTimestamp(order.cancelledAt) : ''}${order.cancelReason ? ` · ${order.cancelReason}` : ''}`} />}
      </div></section>
      <section className="form-card"><h2>Items</h2>
        <div className="product-table-wrap"><Table className="config-table"><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Size</TableHead><TableHead>Price</TableHead><TableHead>Qty</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
          <TableBody>{order.items.map(item => <TableRow key={item.id}><TableCell>{item.productName}{item.isGift ? <small className="cell-note">Free gift from the offer</small> : null}</TableCell><TableCell>{item.variantName}</TableCell><TableCell>{item.isGift ? 'Free' : formatINR(item.unitPricePaise)}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.isGift ? 'Free' : formatINR(item.lineTotalPaise)}</TableCell></TableRow>)}</TableBody></Table></div>
      </section>
    </div>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}>
      {pending && <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">{ORDER_STATUS_LABELS[pending]}</p>
          <AlertDialogTitle>{BUTTON_LABELS[pending]} {order.orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription asChild><div><p>{consequence(order, pending)}</p>{(pending === 'missed' || pending === 'cancelled') && <><label className="product-form-label" htmlFor="order-note">Reason (optional)</label><Textarea id="order-note" rows={3} maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></>}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Keep as it is</Button></AlertDialogCancel><AlertDialogAction asChild><Button className={pending === 'cancelled' || pending === 'missed' ? 'primary-button destructive-button' : 'primary-button'} disabled={busy} onClick={event => { event.preventDefault(); void apply() }}>{busy ? 'Saving…' : BUTTON_LABELS[pending]}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
    <AlertDialog open={returning} onOpenChange={open => { if (!open && !busy) setReturning(false) }}>
      <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">Return money</p>
          <AlertDialogTitle>Return {formatINR(order.totalPaise)} for {order.orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription asChild><div>
            <p>{order.paymentMethod === 'credit' ? `${formatINR(order.totalPaise)} is taken off what the customer owes.` : `The customer paid online. A "refund pending" item appears in Money → Owed to customers for you to refund in PhonePe and record.`} This can be done once for this order.</p>
            <label className="product-form-label" htmlFor="return-reason">Reason (required)</label>
            <Textarea id="return-reason" rows={3} maxLength={200} value={returnReason} onChange={event => setReturnReason(event.target.value)} placeholder="For example: our van could not reach the area" />
          </div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Keep the money</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy || returnReason.trim().length < 3} onClick={event => { event.preventDefault(); void returnMoney() }}>{busy ? 'Saving…' : 'Return money'}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}

/** The courier and tracking link of a courier order. The customer sees them on the order's tracking screen. */
function CourierCard({ order, onSaved }: { order: AdminOrder; onSaved: (order: AdminOrder) => void }) {
  const [courierName, setCourierName] = useState(order.courierName)
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl)
  const [saving, setSaving] = useState(false)
  const linkError = trackingUrl.trim() !== '' && !/^https?:\/\/\S+$/.test(trackingUrl.trim()) ? 'Use a full link starting with https://.' : null
  const changed = courierName.trim() !== order.courierName || trackingUrl.trim() !== order.trackingUrl
  const save = async () => {
    setSaving(true)
    try {
      onSaved(await orderAdminApi.setCourier(order.id, courierName.trim(), trackingUrl.trim()))
      toast.success('Courier details saved. The customer can see them now.')
    } catch (failure) { toast.error(describeApiError(failure)) }
    setSaving(false)
  }
  return <section className="form-card"><h2>Courier</h2><div className="form-grid">
    <div><label className="product-form-label" htmlFor="courier-name">Courier name</label><Input id="courier-name" maxLength={80} value={courierName} onChange={event => setCourierName(event.target.value)} placeholder="For example: Delhivery" /></div>
    <div><label className="product-form-label" htmlFor="tracking-url">Tracking link</label><Input id="tracking-url" type="url" maxLength={500} value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} placeholder="https://" aria-invalid={linkError ? true : undefined} aria-describedby={linkError ? 'tracking-url-error' : undefined} />{linkError ? <p className="field-error" id="tracking-url-error">{linkError}</p> : null}</div>
    <div><Button className="primary-button" disabled={saving || !changed || linkError !== null} onClick={() => void save()}>{saving ? 'Saving…' : 'Save courier details'}</Button></div>
  </div></section>
}

function Row({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
