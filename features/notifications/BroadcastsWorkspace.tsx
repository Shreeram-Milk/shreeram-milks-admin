'use client'

import { useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TablePagination } from '@/components/shared/TablePagination'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { notificationApi, type BroadcastRecord } from './api'
import { BroadcastDialog } from './components/BroadcastDialog'
import { describeAudience } from './schema'

const PAGE_SIZE = 15
const STATUS_LABEL = { sending: 'Sending', sent: 'Sent', failed: 'Not delivered' } as const
const STATUS_TONE = { sending: 'pending', sent: 'active', failed: 'cancelled' } as const

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; rows: BroadcastRecord[]; total: number }

/** Messages sent to groups of customers, newest first, and a way to send a new one (to everyone, to a group, or to chosen customers). */
export function BroadcastsWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    let cancelled = false
    notificationApi.broadcasts(page, PAGE_SIZE).then(
      result => { if (!cancelled) setState({ status: 'ready', rows: result.rows, total: result.total }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [page, reloadKey])

  const reload = () => setReloadKey(count => count + 1)
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Messages could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); reload() }}>Try again</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Notifications' }, { label: 'Send a message' }]} /><h1>Send a message</h1><p className="page-description">Send a notice, a greeting or an offer to everyone, to a group, or to customers you choose. It reaches their phone and also the bell inside the app.</p></div>
      <div className="header-actions">
        <Button variant="outline" className="secondary-button" onClick={reload}><RefreshCw size={15} /> Refresh</Button>
        <Button className="primary-button" onClick={() => setComposing(true)}><Plus size={16} /> New message</Button>
      </div>
    </header>
    <section className="config-section">
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Message</TableHead><TableHead>Sent to</TableHead><TableHead>Customers</TableHead><TableHead>Phones reached</TableHead><TableHead>When</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {state.rows.map(item => <TableRow key={item.id}>
            <TableCell><strong>{item.title}</strong><small className="cell-note">{item.body}</small></TableCell>
            <TableCell>{describeAudience(item.audience)}</TableCell>
            <TableCell>{item.recipients}</TableCell>
            <TableCell>{item.pushed}</TableCell>
            <TableCell>{formatTimestamp(item.createdAt)}</TableCell>
            <TableCell><StatusBadge status={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusBadge></TableCell>
          </TableRow>)}
          {state.rows.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">No messages sent yet.<Button variant="link" className="text-button" onClick={() => setComposing(true)}>Send the first message</Button></div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
      {state.total > PAGE_SIZE && <div className="product-pagination"><span>{state.total} messages · Page {page} of {pageCount}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>}
    </section>
    {composing && <BroadcastDialog onClose={() => setComposing(false)} onSent={() => { setPage(1); reload() }} />}
  </div>
}
