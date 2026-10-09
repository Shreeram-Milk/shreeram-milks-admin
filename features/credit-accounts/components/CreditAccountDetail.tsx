'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, Download, MoreHorizontal, Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatDisplayDate, formatMonthLabel, isIsoMonth, monthOfDate, shiftMonth, todayInBusinessZone } from '@/lib/business-time'
import { downloadCsv } from '@/lib/csv'
import { formatINR } from '@/lib/money'
import { formatAreaAndPin, getPrimaryAddress } from '../../customers/address'
import { creditAccountService, CreditRuleError } from '../service'
import { statementCsv } from '../statement-csv'
import { ACCOUNT_STATUS_LABELS, BILLING_CYCLE_LABELS, type CreditAccountStatus } from '../types'
import { AccountSettingsDialog } from './AccountSettingsDialog'
import { AccountStatusBadge } from './AccountStatusBadge'
import { LedgerTable } from './LedgerTable'
import { ManualAdjustmentDialog } from './ManualAdjustmentDialog'
import { RecordPaymentDialog } from './RecordPaymentDialog'

const PAGE_SIZE = 25
const MONTH_CHOICES = 12
const FILTERS = { month: 'free' } as const
type ActiveDialog = 'payment' | 'adjustment' | 'settings' | null

export function CreditAccountDetail({ customerId }: { customerId: string }) {
  const router = useRouter()
  const { page, filters, update } = useUrlListState(FILTERS)
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState<ActiveDialog>(null)
  const [pendingStatus, setPendingStatus] = useState<CreditAccountStatus | null>(null)
  const currentMonth = monthOfDate(todayInBusinessZone())
  const month = isIsoMonth(filters.month) ? filters.month : currentMonth
  const overview = useMemo(() => { void revision; return creditAccountService.getAccount(customerId) }, [customerId, revision])
  const statement = useMemo(() => { void revision; return overview ? creditAccountService.getStatement(customerId, month) : null }, [customerId, month, revision, overview])
  const issues = useMemo(() => { void revision; return creditAccountService.getIssues(customerId) }, [customerId, revision])

  if (!overview || !statement) return <div className="product-state"><strong>Credit account not found</strong><span>Only customers with the Credit type have a credit account.</span><Link className="secondary-button" href="/credit-accounts">Back to credit accounts</Link></div>

  const { account, customer, balancePaise } = overview
  const refresh = () => setRevision(value => value + 1)
  const monthOptions = Array.from({ length: MONTH_CHOICES }, (_, index) => shiftMonth(currentMonth, -index))
  if (!monthOptions.includes(month)) monthOptions.push(month)
  const newestFirst = [...statement.rows].reverse()
  const pageCount = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const { summary } = statement
  const closed = account.status === 'closed'

  const confirmStatus = () => {
    if (!pendingStatus) return
    try { creditAccountService.setStatus(customerId, pendingStatus); toast.success(`Account ${ACCOUNT_STATUS_LABELS[pendingStatus].toLowerCase()}.`); refresh() }
    catch (error) { toast.error(error instanceof CreditRuleError || error instanceof Error ? error.message : 'Unable to change the status.') }
    setPendingStatus(null)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to credit accounts" onClick={() => router.push('/credit-accounts')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Credit Accounts', href: '/credit-accounts' }, { label: customer.fullName }]} /><h1>{customer.fullName}</h1><p className="page-description">{customer.mobile} · {formatAreaAndPin(getPrimaryAddress(customer))}</p></div>
      </div>
      <div className="header-actions">
        <AccountStatusBadge status={account.status} />
        <span className="header-balance"><small>Current balance</small><strong className={balancePaise > 0 ? 'balance-owed' : undefined}>{formatINR(balancePaise)}</strong></span>
        <Button className="primary-button" disabled={closed || balancePaise <= 0} title={balancePaise <= 0 ? 'No outstanding balance' : undefined} onClick={() => setDialog('payment')}><Wallet size={15} /> Record Payment</Button>
        <Button variant="outline" className="secondary-button" disabled={closed} onClick={() => setDialog('adjustment')}><Plus size={15} /> Manual Adjustment</Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="secondary-button" aria-label="More actions"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link href={`/customers/${customer.id}`}>View customer</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialog('settings')}>Account settings</DropdownMenuItem>
            {(Object.keys(ACCOUNT_STATUS_LABELS) as CreditAccountStatus[]).filter(status => status !== account.status).map(status => <DropdownMenuItem key={status} onSelect={() => setPendingStatus(status)}>Mark {ACCOUNT_STATUS_LABELS[status].toLowerCase()}</DropdownMenuItem>)}
          </DropdownMenuContent></DropdownMenu>
      </div>
    </header>

    {account.status !== 'active' && <p className="warning-note" role="status">{account.status === 'suspended' ? 'This account is suspended. History is kept, and new credit deliveries should be reviewed before continuing. Subscriptions are not changed automatically.' : 'This account is closed and keeps its history only. Payments and adjustments are disabled.'}</p>}
    {overview.overLimit && <p className="warning-note" role="alert">The balance exceeds the credit limit of {formatINR(account.creditLimitPaise ?? 0)}. Deliveries are not stopped automatically.</p>}
    {issues.length > 0 && <div className="serviceability-notice production-issues" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <div><strong>{issues.length} {issues.length === 1 ? 'delivery requires' : 'deliveries require'} attention</strong>
        <ul>{issues.map(issue => <li key={issue.deliveryId}><span>Delivery on {formatDisplayDate(issue.deliveryDate)} — {issue.message}</span> <Link href={`/deliveries/${issue.deliveryId}`}>View Delivery</Link></li>)}</ul>
        <p>These deliveries are not charged until the problem is fixed, so the balance may be understated.</p></div>
    </div>}

    <section className="form-card" aria-labelledby="account-summary-title"><h2 id="account-summary-title">Account summary</h2>
      <dl className="delivery-metrics" aria-label="Account summary">
        <div className="metric-strong"><dt>Current balance</dt><dd>{formatINR(balancePaise)}</dd></div>
        <div><dt>{formatMonthLabel(currentMonth)} charges</dt><dd>{formatINR(overview.monthChargesPaise)}</dd></div>
        <div><dt>{formatMonthLabel(currentMonth)} payments</dt><dd>{formatINR(overview.monthPaymentsPaise)}</dd></div>
        <div><dt>Delivered this month</dt><dd>{overview.deliveredThisMonth}</dd></div>
        <div><dt>Last payment</dt><dd className="metric-small">{overview.lastPayment ? `${formatINR(overview.lastPayment.amountPaise)} · ${formatDisplayDate(overview.lastPayment.occurredOn)}` : '—'}</dd></div>
        <div><dt>Billing cycle</dt><dd className="metric-small">{BILLING_CYCLE_LABELS[account.billingCycle]}</dd></div>
        {account.creditLimitPaise !== null && <div><dt>Credit limit</dt><dd className="metric-small">{formatINR(account.creditLimitPaise)} · {formatINR(Math.max(overview.availableCreditPaise ?? 0, 0))} available</dd></div>}
      </dl>
    </section>

    <section className="form-card" aria-labelledby="statement-title">
      <div className="section-title-row"><div><h2 id="statement-title">Statement</h2><p className="product-hint">Entries are grouped by their effective date, not by when they were recorded.</p></div>
        <div className="statement-tools"><Button type="button" variant="outline" className="secondary-button" onClick={() => downloadCsv(`${customer.fullName.replace(/\s+/g, '-')}-statement-${month}.csv`, statementCsv(customer.fullName, month, summary, statement.rows))}><Download size={15} /> Download CSV</Button><div className="statement-month"><SelectField label="Statement month" value={month} onChange={value => update({ month: value === currentMonth ? null : value })} placeholder="Month" options={monthOptions.map(option => ({ value: option, label: formatMonthLabel(option) }))} /></div></div></div>
      <dl className="statement-summary" aria-label={`Statement for ${formatMonthLabel(month)}`}>
        <div><dt>Opening balance</dt><dd>{formatINR(summary.openingBalancePaise)}</dd></div>
        <div><dt>Delivery charges</dt><dd>{formatINR(summary.chargesPaise)}</dd></div>
        <div><dt>Payments</dt><dd>{formatINR(summary.paymentsPaise)}</dd></div>
        <div><dt>Adjustments</dt><dd>{formatINR(summary.adjustmentsPaise)}</dd></div>
        <div className="closing"><dt>Closing balance</dt><dd>{formatINR(summary.closingBalancePaise)}</dd></div>
      </dl>
      {newestFirst.length === 0
        ? <div className="product-state"><strong>No ledger entries in {formatMonthLabel(month)}</strong><span>Delivered deliveries, payments and adjustments appear here.</span></div>
        : <>
          <LedgerTable rows={newestFirst.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)} />
          <div className="product-pagination"><span>{newestFirst.length} {newestFirst.length === 1 ? 'entry' : 'entries'} · Page {safePage} of {pageCount}</span><TablePagination page={safePage} pageCount={pageCount} onPageChange={next => update({ page: next, month: filters.month || null })} density="compact" /></div>
        </>}
    </section>

    <RecordPaymentDialog key={`pay-${revision}`} customerId={customerId} customerName={customer.fullName} balancePaise={balancePaise} open={dialog === 'payment'} onOpenChange={open => { if (!open) setDialog(null) }} onDone={refresh} />
    <ManualAdjustmentDialog key={`adj-${revision}`} customerId={customerId} customerName={customer.fullName} balancePaise={balancePaise} open={dialog === 'adjustment'} onOpenChange={open => { if (!open) setDialog(null) }} onDone={refresh} />
    <AccountSettingsDialog key={`set-${revision}`} customerId={customerId} creditLimitPaise={account.creditLimitPaise} open={dialog === 'settings'} onOpenChange={open => { if (!open) setDialog(null) }} onDone={refresh} />
    <AlertDialog open={pendingStatus !== null} onOpenChange={open => { if (!open) setPendingStatus(null) }}>
      {pendingStatus && <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader><p className="eyebrow">Account status</p><AlertDialogTitle>Mark {customer.fullName}’s account {ACCOUNT_STATUS_LABELS[pendingStatus].toLowerCase()}?</AlertDialogTitle>
          <AlertDialogDescription>{pendingStatus === 'closed' ? 'A closed account keeps its history but accepts no new payments or adjustments. It can only be closed when the balance is zero.' : pendingStatus === 'suspended' ? 'Existing history stays. Subscriptions and deliveries are not changed automatically — review them separately.' : 'The account returns to normal postpaid charging.'}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Cancel</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" onClick={confirmStatus}>Confirm</Button></AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </div>
}
