'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DeactivateDialog, RecordListToolbar, RecordRowActions } from '@/components/shared/RecordListParts'
import { WindowStatusBadge } from '@/components/shared/WindowStatusBadge'
import { windowState } from '@/lib/active-window'
import { describeApiError } from '@/lib/api-errors'
import { formatDisplayDate, todayInBusinessZone } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { offerApi } from './api'
import { OFFER_KIND_LABELS, type Offer } from './types'

const schedule = (offer: Offer) => {
  if (!offer.startsOn && !offer.endsOn) return 'Always'
  return `${offer.startsOn ? formatDisplayDate(offer.startsOn) : 'Now'} – ${offer.endsOn ? formatDisplayDate(offer.endsOn) : 'No end'}`
}

/** "20% off, up to ₹100", "₹100 off", "Free Cow Ghee - 250 g". */
function describeValue(offer: Offer): string {
  if (offer.kind === 'percent') return `${offer.percent}% off${offer.maxDiscountPaise ? `, up to ${formatINR(offer.maxDiscountPaise)}` : ''}`
  if (offer.kind === 'flat') return `${formatINR(offer.flatPaise ?? 0)} off`
  return `Free ${offer.giftQuantity > 1 ? `${offer.giftQuantity} × ` : ''}${offer.giftLabel ?? 'gift'}`
}

function worksFor(offer: Offer): string {
  const parts = [offer.appliesOneTime && 'One-time', offer.appliesTrial && 'Trials', offer.appliesSubscription && `Subscriptions${offer.minPlanDays ? ` (${offer.minPlanDays}+ days)` : ''}`].filter(Boolean)
  return parts.join(', ')
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; offers: Offer[] }

/** Offers: percent off, flat off and free gifts. Adding and editing happen on their own pages. */
export function OfferWorkspace() {
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [deactivating, setDeactivating] = useState<Offer | null>(null)

  // Bumping this reloads the list from the backend; the effect ignores an answer that arrives after a newer request.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(count => count + 1)
  useEffect(() => {
    let cancelled = false
    offerApi.list().then(
      offers => { if (!cancelled) setState({ status: 'ready', offers }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  const changeStatus = async (offer: Offer, next: Offer['status'], success: string) => {
    try { await offerApi.setStatus(offer.id, next); toast.success(success) } catch (failure) { toast.error(describeApiError(failure)) }
    reload()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Offers could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); reload() }}>Try again</Button></div>

  const { offers } = state
  const today = todayInBusinessZone()
  const filtered = offers.filter(item => (status === 'all' || item.status === status) && `${item.title} ${item.titleGu} ${item.code ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (offer: Offer) => {
    if (offer.status === 'inactive') void changeStatus(offer, 'active', `${offer.title} activated.`)
    else setDeactivating(offer)
  }

  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Offers' }]} /><h1>Offers</h1><p className="page-description">Percent off, flat amount off and free gifts. A customer gets one offer at a time. Totals are always worked out by the server.</p></div>
      <Link className="primary-button" href="/content/offers/new"><Plus size={16} /> Add Offer</Link>
    </header>
    <section className="config-section">
      <RecordListToolbar noun="offers" query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Offer</TableHead><TableHead>What it gives</TableHead><TableHead>Works for</TableHead><TableHead>Minimum</TableHead><TableHead>Runs</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Link className="table-link" href={`/content/offers/${item.id}/edit`}>{item.title}</Link><small className="cell-note">{item.code ? `Code ${item.code}` : 'Applied automatically'}</small></TableCell>
            <TableCell>{describeValue(item)}<small className="cell-note">{OFFER_KIND_LABELS[item.kind]}</small></TableCell>
            <TableCell>{worksFor(item)}</TableCell>
            <TableCell>{item.minOrderPaise ? formatINR(item.minOrderPaise) : 'None'}</TableCell>
            <TableCell>{schedule(item)}</TableCell>
            <TableCell><WindowStatusBadge state={windowState({ status: item.status, startDate: item.startsOn, endDate: item.endsOn }, today)} /></TableCell>
            <TableCell><RecordRowActions name={item.title} active={item.status === 'active'} onEdit={() => router.push(`/content/offers/${item.id}/edit`)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={7}><div className="empty-table">{offers.length ? 'No offers match your search and filters.' : 'No offers yet.'}{offers.length === 0 && <Link className="text-button" href="/content/offers/new">Create the first offer</Link>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    <DeactivateDialog open={Boolean(deactivating)} noun="offer" name={deactivating?.title ?? ''} onCancel={() => setDeactivating(null)} onConfirm={() => { const target = deactivating; setDeactivating(null); if (target) void changeStatus(target, 'inactive', `${target.title} deactivated.`) }} consequence="Customers stop seeing it and it is no longer applied to new orders. Orders and plans that already used it are not changed." />
  </div>
}
