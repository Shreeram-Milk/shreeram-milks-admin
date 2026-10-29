'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { tc } from '@/lib/i18n/common'
import { ORDER_STATUS_LABELS, type OrderStatus } from '../order-admin/api'
import { t } from './messages'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { ACTIVITY_LABELS, FULFILMENT_LABELS, PURPOSE_LABELS, STATUS_LABELS, STATUS_TONE, bankReferenceLabel, describeMethod, paymentAdminApi, type PaymentDetail as Detail } from './api'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; payment: Detail }

/** One payment, step by step: what the customer paid for, what PhonePe said, and what came of it (orders, or a refund). */
export function PaymentDetail({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false
    paymentAdminApi.get(id).then(
      payment => { if (!cancelled) setState({ status: 'ready', payment }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [id, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('detailFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button><Link className="secondary-button" href="/online-payments">{t('backToPayments')}</Link></div>

  const { payment } = state
  const checkNow = async () => {
    setChecking(true)
    try {
      const updated = await paymentAdminApi.check(payment.id)
      setState({ status: 'ready', payment: updated })
      toast.success(updated.status === 'pending' ? t('stillWaiting') : t('phonePeSays', { status: STATUS_LABELS[updated.status].toLowerCase() }))
    } catch (failure) { toast.error(describeApiError(failure)) }
    setChecking(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href="/online-payments" aria-label={t('backToPayments')}><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: t('money') }, { label: t('onlinePayments'), href: '/online-payments' }, { label: formatINR(payment.amountPaise) }]} /><h1>{formatINR(payment.amountPaise)} · {PURPOSE_LABELS[payment.purpose]}</h1><p className="page-description">{t('startedBy', { when: formatTimestamp(payment.createdAt) })} <Link className="product-name-link" href={`/customers/${payment.customerId}`}>{payment.customerName.trim() || t('aCustomer')}</Link> ({payment.customerPhone}).</p></div>
      </div>
      <div className="header-actions">
        <StatusBadge status={STATUS_TONE[payment.status]}>{STATUS_LABELS[payment.status]}</StatusBadge>
        {payment.status === 'pending' ? <Button className="primary-button" disabled={checking} onClick={() => void checkNow()}>{checking ? t('checking') : t('checkPhonePe')}</Button> : null}
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>{t('payment')}</h2><div className="product-detail-rows">
        <Row label={t('status')} value={STATUS_LABELS[payment.status]} />
        <Row label={t('outcome')} value={FULFILMENT_LABELS[payment.fulfilment]} />
        {payment.failureReason ? <Row label={t('reason')} value={payment.failureReason} /> : null}
        <Row label={t('paidAt')} value={payment.paidAt ? formatTimestamp(payment.paidAt) : t('notPaid')} />
        {payment.status !== 'pending' && payment.status !== 'failed' ? <Row label={t('paidWith')} value={describeMethod(payment.method?.mode, payment.method?.instrument, payment.method?.bank)} /> : null}
        {payment.method?.bankReference ? <Row label={bankReferenceLabel(payment.method.mode)} value={payment.method.bankReference} /> : null}
        <Row label={t('ourReference')} value={payment.merchantOrderId} />
        <Row label={t('phonePeOrder')} value={payment.providerOrderId ?? '—'} />
        <Row label={t('phonePeTransaction')} value={payment.providerTransactionId ?? '—'} />
        {payment.status === 'pending' && payment.expiresAt ? <Row label={t('stopsAccepting')} value={formatTimestamp(payment.expiresAt)} /> : null}
      </div></section>
      <section className="form-card"><h2>{t('history')}</h2>
        <ol className="product-detail-rows">{payment.activity.map((step, index) => <li key={`${step.kind}-${index}`}><span>{formatTimestamp(step.createdAt)}</span><strong>{ACTIVITY_LABELS[step.kind]}{typeof step.detail.code === 'string' ? ` (${step.detail.code})` : typeof step.detail.reason === 'string' ? ` (${step.detail.reason})` : ''}</strong></li>)}</ol>
      </section>
      {payment.orders.length > 0 ? <section className="form-card"><h2>{t('orders')}</h2>
        <div className="product-table-wrap"><Table className="config-table"><TableHeader><TableRow><TableHead>{t('order')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('total')}</TableHead></TableRow></TableHeader>
          <TableBody>{payment.orders.map(order => <TableRow key={order.id}><TableCell><Link className="product-name-link" href={`/orders/${order.id}`}>{order.orderNumber}</Link></TableCell><TableCell>{ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status.replaceAll('_', ' ')}</TableCell><TableCell>{formatINR(order.totalPaise)}</TableCell></TableRow>)}</TableBody></Table></div>
      </section> : null}
      {payment.refundDue.length > 0 || payment.refunds.length > 0 ? <section className="form-card"><h2>{t('refunds')}</h2><div className="product-detail-rows">
        {payment.refundDue.map(item => <Row key={item.id} label={item.status === 'pending' ? t('toRefund') : item.status === 'applied' ? t('refundRecorded') : t('cancelled')} value={`${formatINR(item.amountPaise)} · ${item.reason}`} />)}
        {payment.refunds.map((refund, index) => <Row key={index} label={t('refundedOn', { when: formatTimestamp(refund.createdAt) })} value={`${formatINR(refund.amountPaise)}${refund.providerReference ? t('phonePeRef', { reference: refund.providerReference }) : ''}`} />)}
        {payment.refundDue.some(item => item.status === 'pending') ? <Link className="secondary-button" href="/prepaid-adjustments?type=refund_pending">{t('openRefunds')}</Link> : null}
      </div></section> : null}
    </div>
  </div>
}

function Row({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
