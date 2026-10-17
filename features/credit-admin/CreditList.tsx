'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { MoneyHeader } from '../money/MoneyHeader'
import { creditAdminApi, type CreditAccount } from './api'

const PAGE_SIZE = 15
const FILTERS = { show: ['owing'] } as const
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: CreditAccount[]; total: number }

/** Customers who buy on credit, with what each owes against their limit. A customer becomes a credit customer on the Customers page. */
export function CreditList() {
  const { search, page, filters, update, clear, hasActiveFilters } = useUrlListState(FILTERS)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    creditAdminApi.list({ search, owingOnly: filters.show === 'owing', page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, filters.show, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Credit accounts could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="credit" description="Customers who order now and pay later, up to a limit you set. To make someone a pay-later customer, change their type on their customer page." />
    <section className="product-list-section">
      <ListSearchInput label="Search credit accounts" value={search} onCommit={value => update({ search: value })} placeholder="Search by name or phone..." />
      <div className="product-filter-row"><SelectField label="Show" className="product-select-trigger" value={filters.show || ALL} onChange={value => update({ show: value === ALL ? null : value })} placeholder="All pay-later customers" options={[{ value: ALL, label: 'All pay-later customers' }, { value: 'owing', label: 'Only those who owe' }]} /></div>
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'No credit accounts match' : 'No credit customers yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filter.' : 'Open a customer on the Customers page and set their type to Credit.'}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={clear}>Clear filters</Button> : <Link className="secondary-button" href="/customers">Go to Customers</Link>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Owes</TableHead><TableHead>Limit</TableHead><TableHead>Room left</TableHead><TableHead>Last payment</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(account => <TableRow key={account.customerId}>
              <TableCell><Link className="product-name-link" href={`/credit-accounts/${account.customerId}`}>{account.name.trim() || 'No name'}</Link><br /><small>{account.phone}{account.status === 'blocked' ? ' · Blocked' : ''}</small></TableCell>
              <TableCell>{formatINR(account.owedPaise)}</TableCell>
              <TableCell>{account.limitPaise === 0 ? <strong className="field-error">No limit set</strong> : formatINR(account.limitPaise)}</TableCell>
              <TableCell>{formatINR(account.remainingPaise)}</TableCell>
              <TableCell>{account.lastPaymentAt ? formatTimestamp(account.lastPaymentAt) : 'None yet'}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{state.total} {state.total === 1 ? 'account' : 'accounts'} · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
  </div>
}
