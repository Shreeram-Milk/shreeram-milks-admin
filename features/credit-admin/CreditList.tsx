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
import { tc } from '@/lib/i18n/common'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { MoneyHeader } from '../money/MoneyHeader'
import { creditAdminApi, type CreditAccount } from './api'
import { t } from './messages'

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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('listFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="credit" description={t('listDescription')} />
    <section className="product-list-section">
      <ListSearchInput label={t('searchAccounts')} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
      <div className="product-filter-row"><SelectField label={t('show')} className="product-select-trigger" value={filters.show || ALL} onChange={value => update({ show: value === ALL ? null : value })} placeholder={t('allPayLater')} options={[{ value: ALL, label: t('allPayLater') }, { value: 'owing', label: t('onlyOwing') }]} /></div>
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? t('noMatch') : t('noneYet')}</strong><span>{hasActiveFilters ? t('tryChanging') : t('howToAdd')}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={clear}>{tc('clearFilters')}</Button> : <Link className="secondary-button" href="/customers">{t('goToCustomers')}</Link>}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('customer')}</TableHead><TableHead>{t('owes')}</TableHead><TableHead>{t('limit')}</TableHead><TableHead>{t('roomLeft')}</TableHead><TableHead>{t('lastPayment')}</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(account => <TableRow key={account.customerId}>
              <TableCell><Link className="product-name-link" href={`/credit-accounts/${account.customerId}`}>{account.name.trim() || t('noName')}</Link><br /><small>{account.phone}{account.status === 'blocked' ? t('blocked') : ''}</small></TableCell>
              <TableCell>{formatINR(account.owedPaise)}</TableCell>
              <TableCell>{account.limitPaise === 0 ? <strong className="field-error">{t('noLimit')}</strong> : formatINR(account.limitPaise)}</TableCell>
              <TableCell>{formatINR(account.remainingPaise)}</TableCell>
              <TableCell>{account.lastPaymentAt ? formatTimestamp(account.lastPaymentAt) : t('noneYetShort')}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(state.total === 1 ? 'accountOne' : 'accountMany', { count: state.total })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
  </div>
}
