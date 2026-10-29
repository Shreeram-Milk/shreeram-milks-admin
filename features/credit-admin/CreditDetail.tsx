'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { TablePagination } from '@/components/shared/TablePagination'
import { describeApiError } from '@/lib/api-errors'
import { tc } from '@/lib/i18n/common'
import { formatDisplayDate, formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { creditAdminApi, LEDGER_LABELS, type CreditAccount, type LedgerEntry, type PaymentRequest } from './api'
import { AdjustmentDialog, LimitDialog, PaymentDialog, RequestDialog } from './CreditDialogs'
import { t } from './messages'

const LEDGER_PAGE_SIZE = 20
type Dialog = 'limit' | 'payment' | 'adjustment' | 'request' | null
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; account: CreditAccount; requests: PaymentRequest[]; ledger: LedgerEntry[]; ledgerTotal: number }

/** One credit customer: what they owe against their limit, the full ledger, and the things staff can do (record money, correct, ask for payment). */
export function CreditDetail({ customerId }: { customerId: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([creditAdminApi.get(customerId), creditAdminApi.ledger(customerId, page, LEDGER_PAGE_SIZE)]).then(
      ([{ account, openRequests }, ledger]) => { if (!cancelled) setState({ status: 'ready', account, requests: openRequests, ledger: ledger.rows, ledgerTotal: ledger.total }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [customerId, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('detailFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button><Link className="secondary-button" href="/credit-accounts">{t('backToAccounts')}</Link></div>

  const { account, requests, ledger, ledgerTotal } = state
  const close = () => setDialog(null)
  const done = () => { setDialog(null); setPage(1); setReloadKey(count => count + 1) }
  const cancelRequest = async (request: PaymentRequest) => {
    try { await creditAdminApi.cancelRequest(customerId, request.id); toast.success(t('requestCancelled')); setReloadKey(count => count + 1) } catch (failure) { toast.error(describeApiError(failure)) }
  }
  const pageCount = Math.max(1, Math.ceil(ledgerTotal / LEDGER_PAGE_SIZE))
  const name = account.name.trim() || t('customerFallback')

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href="/credit-accounts" aria-label={t('backToAccounts')}><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: t('money') }, { label: t('payLater'), href: '/credit-accounts' }, { label: name }]} /><h1>{name}</h1><p className="page-description">{account.phone} · <Link className="product-name-link" href={`/customers/${account.customerId}`}>{t('openCustomer')}</Link>{account.status === 'blocked' ? t('blockedCannotOrder') : ''}</p></div>
      </div>
      <div className="header-actions">
        <Button className="secondary-button" onClick={() => setDialog('limit')}>{t('changeLimit')}</Button>
        <Button className="secondary-button" onClick={() => setDialog('adjustment')}>{t('correctLedger')}</Button>
        <Button className="secondary-button" disabled={account.owedPaise === 0} onClick={() => setDialog('request')}>{t('askPayment')}</Button>
        <Button className="primary-button" disabled={account.owedPaise === 0} onClick={() => setDialog('payment')}>{t('recordPayment')}</Button>
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>{t('balance')}</h2><div className="product-detail-rows">
        <div><span>{t('owesNow')}</span><strong>{formatINR(account.owedPaise)}</strong></div>
        <div><span>{t('creditLimit')}</span><strong>{formatINR(account.limitPaise)}</strong></div>
        <div><span>{t('roomToOrder')}</span><strong>{formatINR(account.remainingPaise)}</strong></div>
        <div><span>{t('lastPayment')}</span><strong>{account.lastPaymentAt ? formatTimestamp(account.lastPaymentAt) : t('noneYetShort')}</strong></div>
      </div></section>
      <section className="form-card"><h2>{t('openRequests')}</h2>
        {requests.length === 0 ? <p className="product-hint">{t('noRequests')}</p>
          : <ul className="product-reference-list">{requests.map(request => <li key={request.id}>{formatINR(request.amountPaise)}{request.note ? ` · ${request.note}` : ''} <small>{t('asked', { when: formatTimestamp(request.createdAt) })}</small> <Button variant="ghost" className="text-button" onClick={() => void cancelRequest(request)}>{t('cancelRequest')}</Button></li>)}</ul>}
      </section>
      <section className="form-card"><h2>{t('ledger')}</h2>
        {ledger.length === 0 ? <p className="product-hint">{t('ledgerEmpty')}</p>
          : <div className="product-table-wrap"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('what')}</TableHead><TableHead>{t('charge')}</TableHead><TableHead>{t('paymentCredit')}</TableHead><TableHead>{t('owedAfter')}</TableHead></TableRow></TableHeader>
            <TableBody>{ledger.map(entry => <TableRow key={entry.id}>
              <TableCell>{formatDisplayDate(entry.occurredOn)}</TableCell>
              <TableCell>{LEDGER_LABELS[entry.entryType]}{entry.orderNumber ? ` · ${entry.orderNumber}` : ''}{entry.description && entry.entryType !== 'order_charge' ? <><br /><small>{entry.description}</small></> : null}</TableCell>
              <TableCell>{entry.direction === 'debit' ? formatINR(entry.amountPaise) : ''}</TableCell>
              <TableCell>{entry.direction === 'credit' ? formatINR(entry.amountPaise) : ''}</TableCell>
              <TableCell>{formatINR(entry.balancePaise)}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>}
        {ledgerTotal > LEDGER_PAGE_SIZE && <div className="product-pagination"><span>{t('entries', { count: ledgerTotal })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>}
      </section>
    </div>
    {dialog === 'limit' && <LimitDialog account={account} onClose={close} onDone={done} />}
    {dialog === 'payment' && <PaymentDialog account={account} requests={requests} onClose={close} onDone={done} />}
    {dialog === 'adjustment' && <AdjustmentDialog account={account} onClose={close} onDone={done} />}
    {dialog === 'request' && <RequestDialog account={account} onClose={close} onDone={done} />}
  </div>
}
