'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { MoneyHeader } from '../money/MoneyHeader'
import { tc } from '@/lib/i18n/common'
import { t } from './messages'
import { PURPOSE_LABELS, STATUS_LABELS, STATUS_TONE, describeMethod, paymentAdminApi, type OnlinePayment } from './api'

const PAGE_SIZE = 20
const FILTERS = { status: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'], purpose: ['order', 'credit_settlement', 'subscription'] } as const
const ALL = '__all__'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: OnlinePayment[]; total: number }

/** Every online (PhonePe) payment, newest first: who paid, how much, and where it stands. */
export function PaymentList() {
  const { search, page, filters, update, clear, hasActiveFilters } = useUrlListState(FILTERS)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    paymentAdminApi.list({ search, status: filters.status, purpose: filters.purpose, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, filters.status, filters.purpose, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('listFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="payments" description={t('listDescription')} />
    <section className="product-list-section">
      <ListSearchInput label={t('searchPayments')} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
      <div className="product-filter-row">
        <SelectField label={t('status')} className="product-select-trigger" value={filters.status || ALL} onChange={value => update({ status: value === ALL ? null : value })} placeholder={t('allStatuses')} options={[{ value: ALL, label: t('allStatuses') }, ...FILTERS.status.map(value => ({ value, label: STATUS_LABELS[value] }))]} />
        <SelectField label={t('for')} className="product-select-trigger" value={filters.purpose || ALL} onChange={value => update({ purpose: value === ALL ? null : value })} placeholder={t('everything')} options={[{ value: ALL, label: t('everything') }, ...FILTERS.purpose.map(value => ({ value, label: PURPOSE_LABELS[value] }))]} />
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? t('noMatch') : t('noneYet')}</strong><span>{hasActiveFilters ? t('tryChanging') : t('appearHere')}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={clear}>{tc('clearFilters')}</Button> : null}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('started')}</TableHead><TableHead>{t('customer')}</TableHead><TableHead>{t('for')}</TableHead><TableHead>{t('amount')}</TableHead><TableHead>{t('paidWith')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(payment => <TableRow key={payment.id}>
              <TableCell><Link className="product-name-link" href={`/online-payments/${payment.id}`}>{formatTimestamp(payment.createdAt)}</Link><br /><small>{payment.merchantOrderId}</small></TableCell>
              <TableCell>{payment.customerName.trim() || t('noName')}<br /><small>{payment.customerPhone}</small></TableCell>
              <TableCell>{PURPOSE_LABELS[payment.purpose]}</TableCell>
              <TableCell>{formatINR(payment.amountPaise)}</TableCell>
              <TableCell>{payment.method ? describeMethod(payment.method.mode, payment.method.instrument, payment.method.bank) : '—'}</TableCell>
              <TableCell><StatusBadge status={STATUS_TONE[payment.status]}>{STATUS_LABELS[payment.status]}</StatusBadge>{payment.fulfilment === 'refund_due' ? <><br /><strong className="field-error">{t('refundNeeded')}</strong></> : null}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(state.total === 1 ? 'paymentOne' : 'paymentMany', { count: state.total })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
  </div>
}
