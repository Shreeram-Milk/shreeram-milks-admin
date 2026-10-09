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
import { formatINR } from '@/lib/money'
import { windowState } from '@/lib/active-window'
import { OfferDialog } from './components/OfferDialog'
import { offerService } from './service'
import { OFFER_APPLIES_TO_LABELS, type Offer } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

const schedule = (offer: Offer) => {
  if (!offer.startDate && !offer.endDate) return 'Always'
  return `${offer.startDate ? formatDisplayDate(offer.startDate) : 'Now'} – ${offer.endDate ? formatDisplayDate(offer.endDate) : 'No end'}`
}

function OfferWorkspaceContent() {
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  // `undefined` = editor closed, `null` = creating, an offer = editing it.
  const [editing, setEditing] = useState<Offer | null | undefined>(undefined)
  const [deactivating, setDeactivating] = useState<Offer | null>(null)
  const offers = useMemo(() => { void revision; return offerService.list() }, [revision])
  const today = todayInBusinessZone()
  const filtered = offers.filter(item => (status === 'all' || item.status === status) && `${item.name} ${item.nameGujarati} ${item.code}`.toLowerCase().includes(query.trim().toLowerCase()))
  const refresh = () => setRevision(value => value + 1)
  const toggle = (offer: Offer) => {
    if (offer.status === 'inactive') { offerService.setStatus(offer.id, 'active'); toast.success(`${offer.name} activated.`); refresh(); return }
    setDeactivating(offer)
  }
  const confirmDeactivate = () => {
    if (!deactivating) return
    offerService.setStatus(deactivating.id, 'inactive')
    toast.success(`${deactivating.name} deactivated.`)
    setDeactivating(null)
    refresh()
  }
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Offers' }]} /><h1>Offers</h1><p className="page-description">Discounts shown in the customer app. Totals are always calculated by the server.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Add Offer</Button>
    </header>
    <section className="config-section">
      <RecordListToolbar noun="offers" query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Offer</TableHead><TableHead>Discount</TableHead><TableHead>Applies to</TableHead><TableHead>Minimum</TableHead><TableHead>Runs</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(item)}>{item.name}</Button><small className="cell-note">{item.code ? `Code ${item.code}` : 'Applied automatically'}</small></TableCell>
            <TableCell>{offerService.describeValue(item)}</TableCell>
            <TableCell>{OFFER_APPLIES_TO_LABELS[item.appliesTo]}</TableCell>
            <TableCell>{item.minOrderPaise ? formatINR(item.minOrderPaise) : 'None'}</TableCell>
            <TableCell>{schedule(item)}</TableCell>
            <TableCell><WindowStatusBadge state={windowState(item, today)} /></TableCell>
            <TableCell><RecordRowActions name={item.name} active={item.status === 'active'} onEdit={() => setEditing(item)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={7}><div className="empty-table">{offers.length ? 'No offers match your search and filters.' : 'No offers yet.'}{offers.length === 0 && <Button variant="link" className="text-button" onClick={() => setEditing(null)}>Create the first offer</Button>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    {editing !== undefined && <OfferDialog key={editing?.id ?? 'new'} offer={editing} onClose={() => setEditing(undefined)} onDone={refresh} />}
    <DeactivateDialog open={Boolean(deactivating)} noun="offer" name={deactivating?.name ?? ''} onCancel={() => setDeactivating(null)} onConfirm={confirmDeactivate} consequence="Customers stop seeing it and it is no longer applied to new orders. Orders that already used it are not changed." />
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function OfferWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <OfferWorkspaceContent /> : <PageSkeleton />
}
