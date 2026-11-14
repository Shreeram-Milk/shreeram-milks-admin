'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { STAGE_LABELS, STAGE_TONE, stageOf, walletAdminApi, type WalletEntry, type WalletRecord as Record_, type WalletRefund } from './api'
import { AdjustDialog, MoneyStory, RefundDialog } from './WalletDialogs'
import { t } from './messages'
import { t as tm } from '../money/messages'

const PAGE_SIZE = 20
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; record: Record_; history: WalletEntry[]; historyTotal: number }

/** What happened to a request, in words: when it was sent, which payment each part went back to, and its PhonePe reference. */
function HowSent({ refund }: { refund: WalletRefund }) {
  if (refund.status === 'requested') return <span className="product-hint">—</span>
  if (refund.status === 'cancelled') return <span>{refund.handledAt ? t('cancelledOn', { date: formatTimestamp(refund.handledAt) }) : ''}{refund.staffNote ? <><br /><small>{refund.staffNote}</small></> : null}</span>
  return <div className="wallet-how-sent">
    {refund.handledAt ? <span>{t('sentOn', { date: formatTimestamp(refund.handledAt) })}</span> : null}
    {refund.completedAt ? <span className="wallet-in-bank">{t('inBankOn', { date: formatTimestamp(refund.completedAt) })}</span> : null}
    {refund.parts.length > 0
      ? <ul>{refund.parts.map(part => <li key={part.paymentId}>{t('fromPayment', { amount: formatINR(part.amountPaise), payment: part.merchantOrderId })} · <small>{t('refNo', { ref: part.providerReference })}</small></li>)}</ul>
      : <small>{t('oldRecord', { ref: refund.providerReference })}</small>}
    {refund.staffNote ? <small>{refund.staffNote}</small> : null}
  </div>
}

/** One customer's wallet, complete and permanent: the money story, a refund waiting (if any), every request, every PhonePe payment, every line. */
export function WalletRecord({ customerId }: { customerId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<{ kind: 'refund'; id: string } | { kind: 'adjust' } | null>(null)

  useEffect(() => {
    let cancelled = false
    walletAdminApi.record(customerId, page, PAGE_SIZE).then(
      ({ record, history }) => { if (!cancelled) setState({ status: 'ready', record, history: history.items, historyTotal: history.total }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [customerId, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('recordFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{t('retry')}</Button><Link className="secondary-button" href="/wallet-refunds">{t('back')}</Link></div>

  const { record, history, historyTotal } = state
  const name = record.customer.name.trim() || t('noName')
  const open = record.refunds.find(refund => refund.status === 'requested')
  const done = () => { setDialog(null); setPage(1); setReloadKey(count => count + 1) }
  const pageCount = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE))

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href="/wallet-refunds" aria-label={t('back')}><ArrowLeft size={19} /></Link>
        <div>
          <PageBreadcrumbs items={[{ label: tm('money') }, { label: t('wallets'), href: '/wallet-refunds' }, { label: name }]} />
          <h1>{name}</h1>
          <p className="page-description">{record.customer.phone || record.customer.email} · <Link className="product-name-link" href={`/customers/${record.customer.customerId}`}>{t('openCustomer')}</Link></p>
        </div>
      </div>
      <div className="header-actions"><Button className="secondary-button" onClick={() => setDialog({ kind: 'adjust' })}>{t('correct')}</Button></div>
    </header>

    {open ? <section className="wallet-waiting" aria-live="polite">
      <div>
        <strong>{t('waitingTitle', { name, amount: formatINR(open.amountPaise) })}</strong>
        <span>{t('waitingBody', { date: formatTimestamp(open.requestedAt) })}</span>
        {open.customerNote ? <span>{t('customerSaid', { note: open.customerNote })}</span> : null}
      </div>
      <Button className="primary-button" onClick={() => setDialog({ kind: 'refund', id: open.id })}>{t('sendRefund')}</Button>
    </section> : null}

    <section className="form-card wallet-section"><h2>{t('story')}</h2><p className="product-hint">{t('storyHint')}</p><MoneyStory totals={record.totals} /></section>

    <section className="form-card wallet-section"><h2>{t('requests')}</h2><p className="product-hint">{t('requestsHint')}</p>
      {record.refunds.length === 0 ? <p className="product-hint">{t('noRequests')}</p>
        : <div className="product-table-wrap"><Table className="config-table">
          <TableHeader><TableRow><TableHead>{t('askedOn')}</TableHead><TableHead className="num">{t('amount')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('howSent')}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{record.refunds.map(refund => {
            const stage = stageOf(refund)
            return <TableRow key={refund.id}>
              <TableCell>{formatTimestamp(refund.requestedAt)}{refund.customerNote ? <><br /><small>“{refund.customerNote}”</small></> : null}</TableCell>
              <TableCell className="num"><strong>{formatINR(refund.amountPaise)}</strong></TableCell>
              <TableCell><StatusBadge status={STAGE_TONE[stage]}>{STAGE_LABELS[stage]}</StatusBadge></TableCell>
              <TableCell><HowSent refund={refund} /></TableCell>
              <TableCell>{refund.status === 'requested' ? <Button className="primary-button" onClick={() => setDialog({ kind: 'refund', id: refund.id })}>{t('sendRefund')}</Button> : null}</TableCell>
            </TableRow>
          })}</TableBody>
        </Table></div>}
    </section>

    <section className="form-card wallet-section"><h2>{t('payments')}</h2><p className="product-hint">{t('paymentsHint')}</p>
      {record.topUps.length === 0 ? <p className="product-hint">{t('noPayments')}</p>
        : <div className="product-table-wrap"><Table className="config-table">
          <TableHeader><TableRow><TableHead>{t('paidOn')}</TableHead><TableHead className="num">{t('paid')}</TableHead><TableHead>{t('phonePeOrder')}</TableHead><TableHead className="num">{t('refundedFromIt')}</TableHead><TableHead className="num">{t('left')}</TableHead></TableRow></TableHeader>
          <TableBody>{record.topUps.map(payment => <TableRow key={payment.paymentId}>
            <TableCell>{payment.paidAt ? formatTimestamp(payment.paidAt) : ''}</TableCell>
            <TableCell className="num"><strong>{formatINR(payment.amountPaise)}</strong></TableCell>
            <TableCell><span className="wallet-order-id">{payment.merchantOrderId}</span>{payment.transactionId ? <><br /><small>{payment.transactionId}</small></> : null}</TableCell>
            <TableCell className="num">{payment.refundedPaise > 0 ? formatINR(payment.refundedPaise) : '—'}</TableCell>
            <TableCell className="num">{formatINR(payment.leftPaise)}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
    </section>

    <section className="form-card wallet-section"><h2>{t('activity')}</h2>
      {history.length === 0 ? <p className="product-hint">{t('noActivity')}</p>
        : <div className="product-table-wrap"><Table className="config-table">
          <TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('what')}</TableHead><TableHead className="num">{t('moneyIn')}</TableHead><TableHead className="num">{t('moneyOut')}</TableHead></TableRow></TableHeader>
          <TableBody>{history.map(entry => <TableRow key={entry.id}>
            <TableCell>{formatTimestamp(entry.createdAt)}</TableCell>
            <TableCell>{t(`entry_${entry.type}`, { order: entry.orderNumber ?? '' })}{entry.type === 'manual_adjustment' && entry.description ? <><br /><small>{entry.description}</small></> : null}</TableCell>
            <TableCell className="num wallet-in">{entry.direction === 'credit' ? `+${formatINR(entry.amountPaise)}` : ''}</TableCell>
            <TableCell className="num">{entry.direction === 'debit' ? `−${formatINR(entry.amountPaise)}` : ''}</TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
      {historyTotal > PAGE_SIZE && <div className="product-pagination"><span>{t('entries', { count: historyTotal })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>}
    </section>

    {dialog?.kind === 'refund' && <RefundDialog refundId={dialog.id} onClose={() => setDialog(null)} onDone={done} />}
    {dialog?.kind === 'adjust' && <AdjustDialog customerId={customerId} balancePaise={record.totals.balancePaise} onClose={() => setDialog(null)} onDone={done} />}
  </div>
}
