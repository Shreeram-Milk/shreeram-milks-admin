'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { formatCustomerPhone } from '../../customers/record-schema'
import { formatTicketNumber, supportTicketApi, type SupportTicketRecord } from '../api'
import type { SupportCategory } from '../categories'
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, type TicketStatus } from '../types'
import { TicketStatusBadge } from './TicketStatusBadge'
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

const PAGE_SIZE = 10
const ALL = '__all__'
const FILTERS = { status: Object.keys(TICKET_STATUS_LABELS), category: Object.keys(TICKET_CATEGORY_LABELS), customer: 'free' } as const

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: SupportTicketRecord[]; total: number }

/** One page of tickets, loaded from the backend with search and filters applied there. Customers raise tickets in the app. */
export function TicketList() {
  const { search, page, filters, update, hasActiveFilters } = useUrlListState(FILTERS)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  // An answer that arrives after a newer request is ignored.
  useEffect(() => {
    let cancelled = false
    supportTicketApi.list({ search, status: filters.status as TicketStatus | '', category: filters.category as SupportCategory | '', customerId: filters.customer, page, pageSize: PAGE_SIZE }).then(
      result => { if (!cancelled) setState({ status: 'ready', ...result }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [search, filters.status, filters.category, filters.customer, page, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('listFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('operations') }, { label: t('title') }]} /><h1>{t('title')}</h1><p className="page-description">{t('description')}</p></div>
    </header>
    <section className="product-list-section">
      <ListSearchInput label={t('searchTickets')} value={search} onCommit={value => update({ search: value })} placeholder={t('searchPlaceholder')} />
      <div className="product-filter-row">
        <SelectField label={t('status')} className="product-select-trigger" value={filters.status || ALL} onChange={set('status')} placeholder={t('allStatuses')} options={[{ value: ALL, label: t('allStatuses') }, ...(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map(value => ({ value, label: TICKET_STATUS_LABELS[value] }))]} />
        <SelectField label={t('category')} className="product-select-trigger" value={filters.category || ALL} onChange={set('category')} placeholder={t('allCategories')} options={[{ value: ALL, label: t('allCategories') }, ...(Object.keys(TICKET_CATEGORY_LABELS) as SupportCategory[]).map(value => ({ value, label: TICKET_CATEGORY_LABELS[value] }))]} />
      </div>
      {filters.customer && <p className="product-hint">{t('oneCustomer')} <Button type="button" variant="link" className="inline-link" onClick={() => update({ customer: null })}>{t('showAll')}</Button></p>}
      {state.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? t('noMatch') : t('noneYet')}</strong><span>{hasActiveFilters ? t('tryChanging') : t('appearHere')}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>{t('ticket')}</TableHead><TableHead>{t('customer')}</TableHead><TableHead>{t('category')}</TableHead><TableHead>{t('assignedTo')}</TableHead><TableHead>{t('messages')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('updated')}</TableHead></TableRow></TableHeader>
            <TableBody>{state.rows.map(ticket => <TableRow key={ticket.id}>
              <TableCell><Link className="product-name-link" href={`/support/${ticket.id}`}>{formatTicketNumber(ticket.ticketNumber)}</Link></TableCell>
              <TableCell><span className="identity-cell"><InitialsAvatar name={ticket.customerName || formatCustomerPhone(ticket.customerPhone)} /><span>{ticket.customerName || formatCustomerPhone(ticket.customerPhone)}</span></span></TableCell>
              <TableCell>{TICKET_CATEGORY_LABELS[ticket.category]}</TableCell>
              <TableCell>{ticket.assigneeEmail ?? t('unassigned')}</TableCell>
              <TableCell>{ticket.messageCount}</TableCell>
              <TableCell><TicketStatusBadge status={ticket.status} /></TableCell>
              <TableCell>{formatTimestamp(ticket.updatedAt)}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{t(state.total === 1 ? 'ticketOne' : 'ticketMany', { count: state.total })}{t('pageOf', { page: Math.min(page, pageCount), count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
  </div>
}
