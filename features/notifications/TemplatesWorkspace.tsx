'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { DeactivateDialog, RecordListToolbar, RecordRowActions } from '@/components/shared/RecordListParts'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TemplateDialog } from './components/TemplateDialog'
import { eventById } from './events'
import { templateService } from './service'
import type { NotificationTemplate } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

const channels = (template: NotificationTemplate) => [template.pushEnabled && 'App', template.smsEnabled && 'SMS'].filter(Boolean).join(' + ') || 'None'

function TemplatesWorkspaceContent() {
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<NotificationTemplate | undefined>(undefined)
  const [deactivating, setDeactivating] = useState<NotificationTemplate | null>(null)
  const templates = useMemo(() => { void revision; return templateService.list() }, [revision])
  const filtered = templates.filter(item => (status === 'all' || item.status === status) && `${eventById(item.id)?.label} ${item.title} ${item.body}`.toLowerCase().includes(query.trim().toLowerCase()))
  const refresh = () => setRevision(value => value + 1)
  const toggle = (template: NotificationTemplate) => {
    if (template.status === 'active') { setDeactivating(template); return }
    try { templateService.setStatus(template.id, 'active'); toast.success('Template activated.'); refresh() } catch (failure) { toast.error(failure instanceof Error ? failure.message : 'Unable to activate the template.') }
  }
  const confirmDeactivate = () => {
    if (!deactivating) return
    templateService.setStatus(deactivating.id, 'inactive')
    toast.success('Template deactivated.')
    setDeactivating(null)
    refresh()
  }
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Notification Templates' }]} /><h1>Notification Templates</h1><p className="page-description">The messages customers receive automatically. The events are fixed; you can change the wording and channels.</p></div>
    </header>
    <section className="config-section">
      <RecordListToolbar noun="templates" query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Message</TableHead><TableHead>Sent by</TableHead><TableHead>Gujarati</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(item)}>{eventById(item.id)?.label}</Button><small className="cell-note">{eventById(item.id)?.trigger}</small></TableCell>
            <TableCell><strong>{item.title}</strong><small className="cell-note">{item.body}</small></TableCell>
            <TableCell>{channels(item)}</TableCell>
            <TableCell>{item.titleGujarati && item.bodyGujarati ? 'Added' : 'Missing'}</TableCell>
            <TableCell><StatusBadge status={item.status}>{item.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge></TableCell>
            <TableCell><RecordRowActions name={eventById(item.id)?.label ?? 'template'} active={item.status === 'active'} onEdit={() => setEditing(item)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">No templates match your search and filters.</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    {editing && <TemplateDialog key={editing.id} template={editing} onClose={() => setEditing(undefined)} onDone={refresh} />}
    <DeactivateDialog open={Boolean(deactivating)} noun="template" name={deactivating ? eventById(deactivating.id)?.label ?? '' : ''} onCancel={() => setDeactivating(null)} onConfirm={confirmDeactivate} consequence="Customers stop receiving this message automatically. Nothing already sent is affected, and you can activate it again any time." />
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function TemplatesWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <TemplatesWorkspaceContent /> : <PageSkeleton />
}
