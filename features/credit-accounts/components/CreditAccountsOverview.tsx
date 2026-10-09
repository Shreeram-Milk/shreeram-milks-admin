'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { formatAreaAndPin, getPrimaryAddress } from '../../customers/address'
import { creditAccountService, type AccountListQuery } from '../service'
import { ACCOUNT_STATUS_LABELS, BILLING_CYCLE_LABELS, type CreditAccountStatus } from '../types'
import { AccountStatusBadge } from './AccountStatusBadge'

const PAGE_SIZE = 10
const ALL = '__all__'
const FILTERS = { status: ['active', 'suspended', 'closed'], balance: ['outstanding', 'zero'], sort: ['balance_desc', 'balance_asc', 'name', 'recent'] } as const
const SORT_LABELS: Record<AccountListQuery['sort'], string> = { balance_desc: 'Highest balance', balance_asc: 'Lowest balance', name: 'Customer name', recent: 'Recent activity' }

export function CreditAccountsOverview() {
  const { search, page, filters, update, hasActiveFilters } = useUrlListState(FILTERS)
  const sort = (filters.sort || 'balance_desc') as AccountListQuery['sort']
  const result = useMemo(() => creditAccountService.listAccounts({ search, status: filters.status as CreditAccountStatus | '', balanceState: filters.balance as AccountListQuery['balanceState'], sort, page, pageSize: PAGE_SIZE }), [search, filters.status, filters.balance, sort, page])
  const summary = useMemo(() => creditAccountService.getSummary(), [])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })
  const metrics = [
    { label: 'Credit Customers', value: String(summary.creditCustomers) },
    { label: 'Outstanding Accounts', value: String(summary.outstandingAccounts) },
    { label: 'Total Receivable', value: formatINR(summary.totalReceivablePaise), strong: true },
    { label: 'Payments This Month', value: formatINR(summary.paymentsThisMonthPaise) },
  ]
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Finance' }, { label: 'Credit Accounts' }]} /><h1>Credit Accounts</h1><p className="page-description">Track delivered-value balances for postpaid customers.</p></div>
    </header>
    <section className="product-list-section">
      <dl className="delivery-metrics" aria-label="Credit exposure">{metrics.map(metric => <div key={metric.label} className={metric.strong ? 'metric-strong' : undefined}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
      <ListSearchInput label="Search credit accounts" value={search} onCommit={value => update({ search: value })} placeholder="Search by customer or mobile..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(ACCOUNT_STATUS_LABELS) as CreditAccountStatus[]).map(value => ({ value, label: ACCOUNT_STATUS_LABELS[value] }))]} />
        <SelectField label="Balance" className="product-select-trigger" value={filters.balance} onChange={set('balance')} placeholder="All balances" options={[{ value: ALL, label: 'All balances' }, { value: 'outstanding', label: 'Outstanding' }, { value: 'zero', label: 'Zero balance' }]} />
        <SelectField label="Sort by" className="product-select-trigger" value={sort} onChange={value => update({ sort: value === 'balance_desc' ? null : value })} placeholder="Sort by" options={(Object.keys(SORT_LABELS) as AccountListQuery['sort'][]).map(value => ({ value, label: SORT_LABELS[value] }))} />
      </div>
      {result.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'No accounts match these filters' : 'No credit customers yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filters.' : 'Set a customer’s type to Credit to open a credit account.'}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={() => update({ search: null, status: null, balance: null })}>Clear filters</Button> : <Link className="secondary-button" href="/customers">View customers</Link>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table credit-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Mobile</TableHead><TableHead>Area / PIN</TableHead><TableHead>Billing Cycle</TableHead><TableHead className="numeric">Current Charges</TableHead><TableHead className="numeric">Payments</TableHead><TableHead className="numeric">Balance</TableHead><TableHead>Last Activity</TableHead><TableHead>Status</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{result.rows.map(({ account, customer, balancePaise, monthChargesPaise, monthPaymentsPaise, lastActivityOn, overLimit }) => <TableRow key={account.id}>
              <TableCell><span className="identity-cell"><InitialsAvatar name={customer.fullName} /><Link className="product-name-link" href={`/credit-accounts/${customer.id}`}>{customer.fullName}</Link></span></TableCell>
              <TableCell>{customer.mobile}</TableCell>
              <TableCell>{formatAreaAndPin(getPrimaryAddress(customer))}</TableCell>
              <TableCell>{BILLING_CYCLE_LABELS[account.billingCycle]}</TableCell>
              <TableCell className="numeric">{formatINR(monthChargesPaise)}</TableCell>
              <TableCell className="numeric">{formatINR(monthPaymentsPaise)}</TableCell>
              <TableCell className="numeric"><strong className={balancePaise > 0 ? 'balance-owed' : undefined}>{formatINR(balancePaise)}</strong>{overLimit && <em className="product-inactive">Over limit</em>}</TableCell>
              <TableCell>{lastActivityOn ? formatDisplayDate(lastActivityOn) : '—'}</TableCell>
              <TableCell><AccountStatusBadge status={account.status} /></TableCell>
              <TableCell><div className="row-actions product-row-actions"><Link className="secondary-button delivery-action" href={`/credit-accounts/${customer.id}`}>View ledger</Link></div></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'account' : 'accounts'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} density="compact" /></div>
        </>}
    </section>
  </div>
}
