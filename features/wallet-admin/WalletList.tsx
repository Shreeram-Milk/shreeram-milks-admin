'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { MoneyHeader } from '../money/MoneyHeader'
import { walletAdminApi, type WalletOverview, type WalletRow, type WalletShow } from './api'
import { t } from './messages'

const PAGE_SIZE = 15
const FILTERS = { show: ['waiting', 'balance'] } as const

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: WalletRow[]; total: number; overview: WalletOverview }

/** The three numbers that matter, across every wallet. */
function Overview({ overview, onShowWaiting }: { overview: WalletOverview; onShowWaiting: () => void }) {
  return <div className="wallet-overview">
    <div className="wallet-overview-card"><span>{t('inWallets')}</span><strong>{formatINR(overview.heldPaise)}</strong><small>{t('inWalletsHint', { count: overview.customersHolding })}</small></div>
    <button type="button" className={`wallet-overview-card${overview.waitingCount ? ' is-due' : ''}`} onClick={onShowWaiting}>
      <span>{t('toRefund')}</span><strong>{formatINR(overview.waitingPaise)}</strong><small>{overview.waitingCount ? t('toRefundHint', { count: overview.waitingCount }) : t('nothingWaiting')}</small>
    </button>
    <div className="wallet-overview-card"><span>{t('refundedSoFar')}</span><strong>{formatINR(overview.refundedPaise)}</strong><small>{t('refundedHint')}</small></div>
  </div>
}

/** Every customer who has used the wallet: one row each, with the same words and order as their money story. */
export function WalletList() {
  const { search, page, filters, update, clear, hasActiveFilters } = useUrlListState(FILTERS)
  const show = (filters.show || 'all') as WalletShow
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    walletAdminApi.list({ search, show, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', rows: result.items, total: result.total, overview: result.overview }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, show, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{t('retry')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page products-page">
    <MoneyHeader tab="wallet" description={t('description')} />
    <Overview overview={state.overview} onShowWaiting={() => update({ show: 'waiting' })} />
    <section className="product-list-section">
      <ListSearchInput label={t('search')} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
      <div className="list-toolbar">
        <div className="type-tabs" role="group" aria-label={t('show')}>
          {(['all', 'waiting', 'balance'] as const).map(value => <button key={value} type="button" className={`type-tab${show === value ? ' is-active' : ''}`} aria-pressed={show === value} onClick={() => update({ show: value === 'all' ? null : value })}>
            {value === 'all' ? t('showAll') : value === 'waiting' ? t('showWaiting') : t('showBalance')}
          </button>)}
        </div>
      </div>
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? t('noMatch') : t('noneYet')}</strong><span>{hasActiveFilters ? t('tryChanging') : t('noneYetHint')}</span>{hasActiveFilters ? <Button className="secondary-button" variant="outline" onClick={clear}>{t('showAll')}</Button> : null}</div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table wallet-table">
            <TableHeader><TableRow>
              <TableHead>{t('customer')}</TableHead><TableHead className="num">{t('added')}</TableHead><TableHead className="num">{t('spent')}</TableHead>
              <TableHead className="num">{t('refunded')}</TableHead><TableHead className="num">{t('waiting')}</TableHead><TableHead className="num">{t('balance')}</TableHead>
              <TableHead>{t('lastUsed')}</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>{state.rows.map(row => {
              const href = `/wallet-refunds/${row.customerId}`
              return <TableRow key={row.customerId} className={row.waitingPaise > 0 ? 'wallet-row-due' : undefined}>
                <TableCell><Link className="product-name-link" href={href}>{row.name.trim() || t('noName')}</Link><br /><small>{row.phone || row.email}</small></TableCell>
                <TableCell className="num">{formatINR(row.addedPaise)}</TableCell>
                <TableCell className="num">{formatINR(row.spentPaise)}</TableCell>
                <TableCell className="num">{formatINR(row.refundedPaise)}</TableCell>
                <TableCell className="num">{row.waitingPaise > 0 ? <strong className="wallet-due">{formatINR(row.waitingPaise)}</strong> : '—'}</TableCell>
                <TableCell className="num"><strong>{formatINR(row.balancePaise)}</strong></TableCell>
                <TableCell>{row.lastActivityAt ? formatTimestamp(row.lastActivityAt) : ''}</TableCell>
                <TableCell><div className="row-actions product-row-actions">
                  {row.waitingPaise > 0
                    ? <Link className="primary-button wallet-row-button" href={href}>{t('sendRefund')}</Link>
                    : <Link className="secondary-button wallet-row-button" href={href}>{t('open')}</Link>}
                </div></TableCell>
              </TableRow>
            })}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(state.total === 1 ? 'itemOne' : 'itemMany', { count: state.total })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
  </div>
}
