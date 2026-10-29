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
import { tc } from '@/lib/i18n/common'
import { liveLabels } from '@/lib/i18n/core'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { NEXT_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_TONE, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, orderAdminApi, type AdminOrder, type OrderStatus } from './api'
import { t, type OrderKey } from './messages'
import { deliveryText } from './OrderList'
import { bankReferenceLabel, describeMethod } from '../payment-admin/api'

type Step = Exclude<OrderStatus, 'placed'>
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; order: AdminOrder }

const BUTTON_LABELS = liveLabels(t, { out_for_delivery: 'markOut', delivered: 'markDelivered', missed: 'markMissed', cancelled: 'cancelOrder' } satisfies Record<Step, OrderKey>)

/** What a step does to the customer's money, in plain words, for the confirmation. */
function consequence(order: AdminOrder, step: Step): string {
  const amount = formatINR(order.totalPaise)
  if (step === 'out_for_delivery') return t('outConsequence')
  if (step === 'delivered') return t('deliveredConsequence')
  if (step === 'missed') return t('missedConsequence')
  if (order.subscriptionId) return t('cancelSubscriptionConsequence') + (order.paymentMethod === 'credit' ? t('cancelSubscriptionCredit', { amount }) : '')
  return order.paymentMethod === 'credit' ? t('cancelCreditConsequence', { amount }) : t('cancelOnlineConsequence', { amount })
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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('orderLoadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button><Link className="secondary-button" href="/orders">{t('backToOrders')}</Link></div>

  const { order } = state
  const steps = NEXT_STATUSES[order.status]
  const apply = async () => {
    if (!pending) return
    setBusy(true)
    try {
      const updated = await orderAdminApi.setStatus(order.id, pending, note)
      setState({ status: 'ready', order: updated })
      toast.success(t('nowStatus', { number: order.orderNumber, status: ORDER_STATUS_LABELS[pending].toLowerCase() }))
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
      toast.success(order.paymentMethod === 'credit' ? t('takenOffOwed', { amount: formatINR(order.totalPaise) }) : t('addedToRefunds'))
      setReturning(false)
      setReturnReason('')
    } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href="/orders" aria-label={t('backToOrders')}><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: t('orders'), href: '/orders' }, { label: order.orderNumber }]} /><h1>{order.orderNumber}</h1><p className="page-description">{t('placedBy', { when: formatTimestamp(order.placedAt) })} <Link className="product-name-link" href={`/customers/${order.customerId}`}>{order.customerName.trim() || t('aCustomer')}</Link>.</p></div>
      </div>
      <div className="header-actions">
        <StatusBadge status={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge>
        {steps.map(step => <Button key={step} className={step === 'cancelled' || step === 'missed' ? 'secondary-button' : 'primary-button'} onClick={() => setPending(step)}>{BUTTON_LABELS[step]}</Button>)}
        {canReturnMoney(order) ? <Button className="secondary-button" variant="outline" onClick={() => setReturning(true)}>{t('returnMoney')}</Button> : null}
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>{t('delivery')}</h2><div className="product-detail-rows">
        <Row label={t('when')} value={deliveryText(order)} />
        {order.orderBy && <Row label={t('orderingClosed')} value={formatTimestamp(order.orderBy)} />}
        <Row label={t('recipient')} value={`${order.recipientName} · ${order.recipientPhone}`} />
        <Row label={t('address')} value={[order.addressLine1, order.addressLine2, order.landmark, order.city].filter(Boolean).join(', ') + ` – ${order.pinCode}`} />
        {order.doorstepNote && <Row label={t('doorstepNote')} value={order.doorstepNote} />}
        {order.subscriptionId ? <div><span>{t('subscription')}</span><Link className="product-name-link" href={`/subscriptions/${order.subscriptionId}`}>{order.items[0]?.purchaseMethod === 'trial' ? t('oneTrialDelivery') : t('oneSubscriptionDelivery')}</Link></div> : null}
      </div></section>
      {order.deliveryMethod === 'shipping' ? <CourierCard key={`${order.courierName}|${order.trackingUrl}`} order={order} onSaved={updated => setState({ status: 'ready', order: updated })} /> : null}
      <section className="form-card"><h2>{t('payment')}</h2><div className="product-detail-rows">
        <Row label={t('method')} value={PAYMENT_LABELS[order.paymentMethod]} />
        <Row label={t('paymentStatus')} value={order.paymentMethod === 'credit' ? t('chargedToCredit') : PAYMENT_STATUS_LABELS[order.paymentStatus]} />
        {order.onlinePayment ? <>
          <Row label={t('paidWith')} value={describeMethod(order.onlinePayment.mode, order.onlinePayment.instrument, order.onlinePayment.bank)} />
          {order.onlinePayment.paidAt ? <Row label={t('paidAt')} value={formatTimestamp(order.onlinePayment.paidAt)} /> : null}
          <Row label={t('phonePeTransaction')} value={order.onlinePayment.providerTransactionId ?? '—'} />
          <Row label={t('phonePeOrder')} value={order.onlinePayment.providerOrderId ?? '—'} />
          <Row label={t('ourReference')} value={order.onlinePayment.merchantOrderId} />
          {order.onlinePayment.bankReference ? <Row label={bankReferenceLabel(order.onlinePayment.mode)} value={order.onlinePayment.bankReference} /> : null}
          {order.onlinePayment.amountPaise !== order.totalPaise ? <Row label={t('paymentCovered')} value={t('coveredOthers', { amount: formatINR(order.onlinePayment.amountPaise) })} /> : null}
          <div><span /><Link className="product-name-link" href={`/online-payments/${order.onlinePayment.id}`}>{t('viewPayment')}</Link></div>
        </> : null}
        <Row label={t('subtotal')} value={formatINR(order.subtotalPaise)} />
        {order.offerTitle ? <Row label={t('offerUsed')} value={order.discountPaise > 0 ? `${order.offerTitle} (−${formatINR(order.discountPaise)})` : order.offerTitle} /> : null}
        <Row label={t('total')} value={formatINR(order.totalPaise)} />
        {order.moneyReturnedAt ? <Row label={t('moneyReturned')} value={formatTimestamp(order.moneyReturnedAt)} /> : null}
        {order.status === 'cancelled' && <Row label={t('cancelled')} value={`${order.cancelledAt ? formatTimestamp(order.cancelledAt) : ''}${order.cancelReason ? ` · ${order.cancelReason}` : ''}`} />}
      </div></section>
      <section className="form-card"><h2>{t('items')}</h2>
        <div className="product-table-wrap"><Table className="config-table"><TableHeader><TableRow><TableHead>{t('product')}</TableHead><TableHead>{t('size')}</TableHead><TableHead>{t('price')}</TableHead><TableHead>{t('qty')}</TableHead><TableHead>{t('total')}</TableHead></TableRow></TableHeader>
          <TableBody>{order.items.map(item => <TableRow key={item.id}><TableCell>{item.productName}{item.isGift ? <small className="cell-note">{t('freeGift')}</small> : null}</TableCell><TableCell>{item.variantName}</TableCell><TableCell>{item.isGift ? t('free') : formatINR(item.unitPricePaise)}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{item.isGift ? t('free') : formatINR(item.lineTotalPaise)}</TableCell></TableRow>)}</TableBody></Table></div>
      </section>
    </div>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null) }}>
      {pending && <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">{ORDER_STATUS_LABELS[pending]}</p>
          <AlertDialogTitle>{t('confirmStep', { step: BUTTON_LABELS[pending], number: order.orderNumber })}</AlertDialogTitle>
          <AlertDialogDescription asChild><div><p>{consequence(order, pending)}</p>{(pending === 'missed' || pending === 'cancelled') && <><label className="product-form-label" htmlFor="order-note">{t('reasonOptional')}</label><Textarea id="order-note" rows={3} maxLength={300} value={note} onChange={event => setNote(event.target.value)} /></>}</div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('keepAsIs')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className={pending === 'cancelled' || pending === 'missed' ? 'primary-button destructive-button' : 'primary-button'} disabled={busy} onClick={event => { event.preventDefault(); void apply() }}>{busy ? tc('saving') : BUTTON_LABELS[pending]}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
    <AlertDialog open={returning} onOpenChange={open => { if (!open && !busy) setReturning(false) }}>
      <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">{t('returnMoney')}</p>
          <AlertDialogTitle>{t('returnTitle', { amount: formatINR(order.totalPaise), number: order.orderNumber })}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>
            <p>{order.paymentMethod === 'credit' ? t('returnCredit', { amount: formatINR(order.totalPaise) }) : t('returnOnline')}{t('returnOnce')}</p>
            <label className="product-form-label" htmlFor="return-reason">{t('reasonRequired')}</label>
            <Textarea id="return-reason" rows={3} maxLength={200} value={returnReason} onChange={event => setReturnReason(event.target.value)} placeholder={t('returnPlaceholder')} />
          </div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('keepMoney')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy || returnReason.trim().length < 3} onClick={event => { event.preventDefault(); void returnMoney() }}>{busy ? tc('saving') : t('returnMoney')}</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}

/** The courier and tracking link of a courier order. The customer sees them on the order's tracking screen. */
function CourierCard({ order, onSaved }: { order: AdminOrder; onSaved: (order: AdminOrder) => void }) {
  const [courierName, setCourierName] = useState(order.courierName)
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl)
  const [saving, setSaving] = useState(false)
  const linkError = trackingUrl.trim() !== '' && !/^https?:\/\/\S+$/.test(trackingUrl.trim()) ? t('fullLink') : null
  const changed = courierName.trim() !== order.courierName || trackingUrl.trim() !== order.trackingUrl
  const save = async () => {
    setSaving(true)
    try {
      onSaved(await orderAdminApi.setCourier(order.id, courierName.trim(), trackingUrl.trim()))
      toast.success(t('courierSaved'))
    } catch (failure) { toast.error(describeApiError(failure)) }
    setSaving(false)
  }
  return <section className="form-card"><h2>{t('courier')}</h2><div className="form-grid">
    <div><label className="product-form-label" htmlFor="courier-name">{t('courierName')}</label><Input id="courier-name" maxLength={80} value={courierName} onChange={event => setCourierName(event.target.value)} placeholder={t('courierPlaceholder')} /></div>
    <div><label className="product-form-label" htmlFor="tracking-url">{t('trackingLink')}</label><Input id="tracking-url" type="url" maxLength={500} value={trackingUrl} onChange={event => setTrackingUrl(event.target.value)} placeholder="https://" aria-invalid={linkError ? true : undefined} aria-describedby={linkError ? 'tracking-url-error' : undefined} />{linkError ? <p className="field-error" id="tracking-url-error">{linkError}</p> : null}</div>
    <div><Button className="primary-button" disabled={saving || !changed || linkError !== null} onClick={() => void save()}>{saving ? tc('saving') : t('saveCourier')}</Button></div>
  </div></section>
}

function Row({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
