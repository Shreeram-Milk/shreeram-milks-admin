'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { ListSearchInput } from '@/components/shared/ListSearchInput'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { TablePagination } from '@/components/shared/TablePagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { formatTimestamp } from '@/lib/business-time'
import { supportTicketService } from '../service'
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, type TicketCategory, type TicketStatus } from '../types'
import { NewTicketDialog } from './NewTicketDialog'
import { TicketStatusBadge } from './TicketStatusBadge'

const PAGE_SIZE = 10
const ALL = '__all__'
const FILTERS = { status: Object.keys(TICKET_STATUS_LABELS), category: Object.keys(TICKET_CATEGORY_LABELS), customer: 'free' } as const

export function TicketsList() {
  const router = useRouter()
  const { search, page, filters, update, hasActiveFilters } = useUrlListState(FILTERS)
  const [logging, setLogging] = useState(false)
  const result = useMemo(() => supportTicketService.list({ search, status: filters.status as TicketStatus | '', category: filters.category as TicketCategory | '', customerId: filters.customer, page, pageSize: PAGE_SIZE }), [search, filters.status, filters.category, filters.customer, page])
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const set = (key: string) => (value: string) => update({ [key]: value === ALL ? null : value })
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Operations' }, { label: 'Support Tickets' }]} /><h1>Support Tickets</h1><p className="page-description">Issues reported by customers, from the app or by phone.</p></div>
      <Button className="primary-button" onClick={() => setLogging(true)}><Plus size={15} /> Log Ticket</Button>
    </header>
    <section className="product-list-section">
      <ListSearchInput label="Search tickets" value={search} onCommit={value => update({ search: value })} placeholder="Search by ticket, customer, mobile, or order..." />
      <div className="product-filter-row">
        <SelectField label="Status" className="product-select-trigger" value={filters.status} onChange={set('status')} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map(value => ({ value, label: TICKET_STATUS_LABELS[value] }))]} />
        <SelectField label="Category" className="product-select-trigger" value={filters.category} onChange={set('category')} placeholder="All categories" options={[{ value: ALL, label: 'All categories' }, ...(Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]).map(value => ({ value, label: TICKET_CATEGORY_LABELS[value] }))]} />
      </div>
      {filters.customer && <p className="product-hint">Showing tickets for one customer. <Button type="button" variant="link" className="inline-link" onClick={() => update({ customer: null })}>Show all customers</Button></p>}
      {result.total === 0
        ? <div className="product-state"><strong>{hasActiveFilters ? 'No tickets match these filters' : 'No tickets yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or filters.' : 'Tickets from the app and logged calls appear here.'}</span></div>
        : <>
          <div className="table-card product-list-table-card"><Table className="config-table">
            <TableHeader><TableRow><TableHead>Ticket</TableHead><TableHead>Customer</TableHead><TableHead>Category</TableHead><TableHead>Order</TableHead><TableHead>Assigned to</TableHead><TableHead>Status</TableHead><TableHead>Last activity</TableHead></TableRow></TableHeader>
            <TableBody>{result.rows.map(({ ticket, customer, orderNumber }) => <TableRow key={ticket.id}>
              <TableCell><Link className="product-name-link" href={`/support/${ticket.id}`}>{ticket.ticketNumber}</Link></TableCell>
              <TableCell><span className="identity-cell"><InitialsAvatar name={customer?.fullName ?? '?'} /><span>{customer?.fullName ?? 'Unknown customer'}</span></span></TableCell>
              <TableCell>{TICKET_CATEGORY_LABELS[ticket.category]}</TableCell>
              <TableCell>{orderNumber || '—'}</TableCell>
              <TableCell>{ticket.assignee || 'Unassigned'}</TableCell>
              <TableCell><TicketStatusBadge status={ticket.status} /></TableCell>
              <TableCell>{formatTimestamp(ticket.updatedAt)}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="product-pagination"><span>{result.total} {result.total === 1 ? 'ticket' : 'tickets'} · Page {Math.min(page, pageCount)} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={next => update({ page: next })} /></div>
        </>}
    </section>
    {logging && <NewTicketDialog presetCustomerId={filters.customer || undefined} onClose={() => setLogging(false)} onCreated={id => router.push(`/support/${id}`)} />}
  </div>
}
