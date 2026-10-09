'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { DeactivateDialog, RecordListToolbar, RecordRowActions } from '@/components/shared/RecordListParts'
import { WindowStatusBadge } from '@/components/shared/WindowStatusBadge'
import { formatDisplayDate, todayInBusinessZone } from '@/lib/business-time'
import { windowState } from '@/lib/active-window'
import { BannerDialog } from './components/BannerDialog'
import { bannerService } from './service'
import type { Banner } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

const schedule = (banner: Banner) => {
  if (!banner.startDate && !banner.endDate) return 'Always'
  return `${banner.startDate ? formatDisplayDate(banner.startDate) : 'Now'} – ${banner.endDate ? formatDisplayDate(banner.endDate) : 'No end'}`
}

function BannerWorkspaceContent() {
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  // `undefined` = editor closed, `null` = creating, a banner = editing it.
  const [editing, setEditing] = useState<Banner | null | undefined>(undefined)
  const [deactivating, setDeactivating] = useState<Banner | null>(null)
  const banners = useMemo(() => { void revision; return bannerService.list() }, [revision])
  const today = todayInBusinessZone()
  const filtered = banners.filter(item => (status === 'all' || item.status === status) && `${item.title} ${item.titleGujarati} ${item.label}`.toLowerCase().includes(query.trim().toLowerCase()))
  const refresh = () => setRevision(value => value + 1)
  const toggle = (banner: Banner) => {
    if (banner.status === 'inactive') { bannerService.setStatus(banner.id, 'active'); toast.success('Banner activated.'); refresh(); return }
    setDeactivating(banner)
  }
  const confirmDeactivate = () => {
    if (!deactivating) return
    bannerService.setStatus(deactivating.id, 'inactive')
    toast.success('Banner deactivated.')
    setDeactivating(null)
    refresh()
  }
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Banners' }]} /><h1>Banners</h1><p className="page-description">Promotional banners shown on the customer app’s home screen.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Add Banner</Button>
    </header>
    <section className="config-section">
      <RecordListToolbar noun="banners" query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Banner</TableHead><TableHead>Opens</TableHead><TableHead>Runs</TableHead><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(item)}>{item.title}</Button>{item.label && <small className="cell-note">{item.label}</small>}</TableCell>
            <TableCell>{bannerService.linkLabel(item)}</TableCell>
            <TableCell>{schedule(item)}</TableCell>
            <TableCell>{item.sortOrder}</TableCell>
            <TableCell><WindowStatusBadge state={windowState(item, today)} /></TableCell>
            <TableCell><RecordRowActions name={item.title} active={item.status === 'active'} onEdit={() => setEditing(item)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">{banners.length ? 'No banners match your search and filters.' : 'No banners yet.'}{banners.length === 0 && <Button variant="link" className="text-button" onClick={() => setEditing(null)}>Create the first banner</Button>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    {editing !== undefined && <BannerDialog key={editing?.id ?? 'new'} banner={editing} nextSortOrder={Math.max(0, ...banners.map(item => item.sortOrder)) + 1} onClose={() => setEditing(undefined)} onDone={refresh} />}
    <DeactivateDialog open={Boolean(deactivating)} noun="banner" name={deactivating?.title ?? ''} onCancel={() => setDeactivating(null)} onConfirm={confirmDeactivate} consequence="It disappears from the customer app’s home screen straight away. You can activate it again any time." />
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function BannerWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <BannerWorkspaceContent /> : <PageSkeleton />
}
