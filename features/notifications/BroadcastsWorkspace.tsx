'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Ban, CalendarClock, Edit2, MoreHorizontal, Plus, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDisplayDate, formatTime12h } from '@/lib/business-time'
import { BroadcastDialog } from './components/BroadcastDialog'
import { ScheduleDialog } from './components/ScheduleDialog'
import { broadcastService } from './service'
import { BROADCAST_AUDIENCE_LABELS, BROADCAST_CHANNEL_LABELS, BROADCAST_STATUS_LABELS, type Broadcast, type BroadcastStatus } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

const BADGE_STATUS: Record<BroadcastStatus, string> = { draft: 'draft', scheduled: 'active', cancelled: 'cancelled' }
const ALL = '__all__'

function BroadcastsWorkspaceContent() {
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState(ALL)
  // `undefined` = editor closed, `null` = creating, a broadcast = editing it.
  const [editing, setEditing] = useState<Broadcast | null | undefined>(undefined)
  const [scheduling, setScheduling] = useState<Broadcast | null>(null)
  const broadcasts = useMemo(() => { void revision; return broadcastService.list() }, [revision])
  const filtered = broadcasts.filter(item => status === ALL || item.status === status)
  const refresh = () => setRevision(value => value + 1)
  const move = (broadcast: Broadcast, next: BroadcastStatus, success: string) => {
    try { broadcastService.changeStatus(broadcast.id, next); toast.success(success); refresh() } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Something went wrong.') }
  }
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Broadcasts' }]} /><h1>Broadcasts</h1><p className="page-description">One-off messages to groups of customers, such as festive greetings or service notices.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> New Broadcast</Button>
    </header>
    <p className="warning-note" role="note">Scheduled broadcasts are queued. They start going out once the notification service is connected to the backend.</p>
    <section className="config-section">
      <div className="config-filter-row"><SelectField label="Filter by status" className="config-select product-select-trigger" value={status} onChange={setStatus} placeholder="All statuses" options={[{ value: ALL, label: 'All statuses' }, ...(Object.keys(BROADCAST_STATUS_LABELS) as BroadcastStatus[]).map(value => ({ value, label: BROADCAST_STATUS_LABELS[value] }))]} /><span className="record-count">{filtered.length} {filtered.length === 1 ? 'broadcast' : 'broadcasts'}</span></div>
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Broadcast</TableHead><TableHead>Audience</TableHead><TableHead>Sent as</TableHead><TableHead>When</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><strong>{item.title}</strong><small className="cell-note">{item.body}</small></TableCell>
            <TableCell>{BROADCAST_AUDIENCE_LABELS[item.audience]}<small className="cell-note">{broadcastService.audienceCount(item.audience)} customers now</small></TableCell>
            <TableCell>{BROADCAST_CHANNEL_LABELS[item.channel]}</TableCell>
            <TableCell>{item.status === 'scheduled' ? `${formatDisplayDate(item.scheduledDate as string)}, ${formatTime12h(item.scheduledTime)}` : '—'}</TableCell>
            <TableCell><StatusBadge status={BADGE_STATUS[item.status]}>{BROADCAST_STATUS_LABELS[item.status]}</StatusBadge></TableCell>
            <TableCell>{item.status !== 'cancelled' && <div className="row-actions"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`Actions for ${item.title}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {item.status === 'draft' && <DropdownMenuItem onSelect={() => setEditing(item)}><Edit2 /> Edit</DropdownMenuItem>}
                {item.status === 'draft' && <DropdownMenuItem onSelect={() => setScheduling(item)}><CalendarClock /> Schedule</DropdownMenuItem>}
                {item.status === 'scheduled' && <DropdownMenuItem onSelect={() => move(item, 'draft', 'Moved back to draft.')}><Undo2 /> Move to draft</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => move(item, 'cancelled', 'Broadcast cancelled.')}><Ban /> Cancel broadcast</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu></div>}</TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">{broadcasts.length ? 'No broadcasts match this filter.' : 'No broadcasts yet.'}{broadcasts.length === 0 && <Button variant="link" className="text-button" onClick={() => setEditing(null)}>Create the first broadcast</Button>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    {editing !== undefined && <BroadcastDialog key={editing?.id ?? 'new'} broadcast={editing} onClose={() => setEditing(undefined)} onDone={refresh} />}
    {scheduling && <ScheduleDialog key={scheduling.id} broadcast={scheduling} onClose={() => setScheduling(null)} onDone={refresh} />}
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function BroadcastsWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <BroadcastsWorkspaceContent /> : <PageSkeleton />
}
