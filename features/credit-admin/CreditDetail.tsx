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
import { formatDisplayDate, formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { creditAdminApi, LEDGER_LABELS, type CreditAccount, type LedgerEntry, type PaymentRequest } from './api'
import { AdjustmentDialog, LimitDialog, PaymentDialog, RequestDialog } from './CreditDialogs'

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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>This credit account could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button><Link className="secondary-button" href="/credit-accounts">Back to credit accounts</Link></div>

  const { account, requests, ledger, ledgerTotal } = state
  const close = () => setDialog(null)
  const done = () => { setDialog(null); setPage(1); setReloadKey(count => count + 1) }
  const cancelRequest = async (request: PaymentRequest) => {
    try { await creditAdminApi.cancelRequest(customerId, request.id); toast.success('Request cancelled.'); setReloadKey(count => count + 1) } catch (failure) { toast.error(describeApiError(failure)) }
  }
  const pageCount = Math.max(1, Math.ceil(ledgerTotal / LEDGER_PAGE_SIZE))
  const name = account.name.trim() || 'Customer'

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href="/credit-accounts" aria-label="Back to credit accounts"><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: 'Money' }, { label: 'Pay-later customers', href: '/credit-accounts' }, { label: name }]} /><h1>{name}</h1><p className="page-description">{account.phone} · <Link className="product-name-link" href={`/customers/${account.customerId}`}>Open customer</Link>{account.status === 'blocked' ? ' · Blocked: cannot order' : ''}</p></div>
      </div>
      <div className="header-actions">
        <Button className="secondary-button" onClick={() => setDialog('limit')}>Change limit</Button>
        <Button className="secondary-button" onClick={() => setDialog('adjustment')}>Correct ledger</Button>
        <Button className="secondary-button" disabled={account.owedPaise === 0} onClick={() => setDialog('request')}>Ask for payment</Button>
        <Button className="primary-button" disabled={account.owedPaise === 0} onClick={() => setDialog('payment')}>Record payment</Button>
      </div>
    </header>
    <div className="product-detail-grid">
      <section className="form-card"><h2>Balance</h2><div className="product-detail-rows">
        <div><span>Owes now</span><strong>{formatINR(account.owedPaise)}</strong></div>
        <div><span>Credit limit</span><strong>{formatINR(account.limitPaise)}</strong></div>
        <div><span>Room left to order</span><strong>{formatINR(account.remainingPaise)}</strong></div>
        <div><span>Last payment</span><strong>{account.lastPaymentAt ? formatTimestamp(account.lastPaymentAt) : 'None yet'}</strong></div>
      </div></section>
      <section className="form-card"><h2>Open payment requests</h2>
        {requests.length === 0 ? <p className="product-hint">None. Use Ask for payment to send the customer a Pay now card.</p>
          : <ul className="product-reference-list">{requests.map(request => <li key={request.id}>{formatINR(request.amountPaise)}{request.note ? ` · ${request.note}` : ''} <small>asked {formatTimestamp(request.createdAt)}</small> <Button variant="ghost" className="text-button" onClick={() => void cancelRequest(request)}>Cancel request</Button></li>)}</ul>}
      </section>
      <section className="form-card"><h2>Ledger</h2>
        {ledger.length === 0 ? <p className="product-hint">Nothing yet. Orders on credit, payments and corrections appear here.</p>
          : <div className="product-table-wrap"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>What</TableHead><TableHead>Charge</TableHead><TableHead>Payment / credit</TableHead><TableHead>Owed after</TableHead></TableRow></TableHeader>
            <TableBody>{ledger.map(entry => <TableRow key={entry.id}>
              <TableCell>{formatDisplayDate(entry.occurredOn)}</TableCell>
              <TableCell>{LEDGER_LABELS[entry.entryType]}{entry.orderNumber ? ` · ${entry.orderNumber}` : ''}{entry.description && entry.entryType !== 'order_charge' ? <><br /><small>{entry.description}</small></> : null}</TableCell>
              <TableCell>{entry.direction === 'debit' ? formatINR(entry.amountPaise) : ''}</TableCell>
              <TableCell>{entry.direction === 'credit' ? formatINR(entry.amountPaise) : ''}</TableCell>
              <TableCell>{formatINR(entry.balancePaise)}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>}
        {ledgerTotal > LEDGER_PAGE_SIZE && <div className="product-pagination"><span>{ledgerTotal} entries · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>}
      </section>
    </div>
    {dialog === 'limit' && <LimitDialog account={account} onClose={close} onDone={done} />}
    {dialog === 'payment' && <PaymentDialog account={account} requests={requests} onClose={close} onDone={done} />}
    {dialog === 'adjustment' && <AdjustmentDialog account={account} onClose={close} onDone={done} />}
    {dialog === 'request' && <RequestDialog account={account} onClose={close} onDone={done} />}
  </div>
}
