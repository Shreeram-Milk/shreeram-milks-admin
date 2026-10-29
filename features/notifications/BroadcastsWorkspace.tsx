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
import { tc } from '@/lib/i18n/common'
import { liveLabels } from '@/lib/i18n/core'
import { t } from './messages'

const PAGE_SIZE = 15
const STATUS_LABEL = liveLabels(t, { sending: 'statusSending', sent: 'statusSent', failed: 'statusFailed' })
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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); reload() }}>{tc('tryAgain')}</Button></div>

  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE))
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('notifications') }, { label: t('sendMessage') }]} /><h1>{t('sendMessage')}</h1><p className="page-description">{t('broadcastsDescription')}</p></div>
      <div className="header-actions">
        <Button variant="outline" className="secondary-button" onClick={reload}><RefreshCw size={15} /> {t('refresh')}</Button>
        <Button className="primary-button" onClick={() => setComposing(true)}><Plus size={16} /> {t('newMessage')}</Button>
      </div>
    </header>
    <section className="config-section">
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>{t('message')}</TableHead><TableHead>{t('sentTo')}</TableHead><TableHead>{t('customers')}</TableHead><TableHead>{t('phonesReached')}</TableHead><TableHead>{t('when')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader>
        <TableBody>
          {state.rows.map(item => <TableRow key={item.id}>
            <TableCell><strong>{item.title}</strong><small className="cell-note">{item.body}</small></TableCell>
            <TableCell>{describeAudience(item.audience)}</TableCell>
            <TableCell>{item.recipients}</TableCell>
            <TableCell>{item.pushed}</TableCell>
            <TableCell>{formatTimestamp(item.createdAt)}</TableCell>
            <TableCell><StatusBadge status={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</StatusBadge></TableCell>
          </TableRow>)}
          {state.rows.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">{t('noneSent')}<Button variant="link" className="text-button" onClick={() => setComposing(true)}>{t('sendFirst')}</Button></div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
      {state.total > PAGE_SIZE && <div className="product-pagination"><span>{t('messagesCount', { count: state.total })}{t('pageOf', { page, count: pageCount })}</span><TablePagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={setPage} /></div>}
    </section>
    {composing && <BroadcastDialog onClose={() => setComposing(false)} onSent={() => { setPage(1); reload() }} />}
  </div>
}
