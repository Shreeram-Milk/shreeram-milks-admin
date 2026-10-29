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
import { tc } from '@/lib/i18n/common'
import { t } from './messages'

const schedule = (offer: Offer) => {
  if (!offer.startsOn && !offer.endsOn) return t('always')
  return `${offer.startsOn ? formatDisplayDate(offer.startsOn) : t('now')} – ${offer.endsOn ? formatDisplayDate(offer.endsOn) : t('noEnd')}`
}

/** "20% off, up to ₹100", "₹100 off", "Free Cow Ghee - 250 g". */
function describeValue(offer: Offer): string {
  if (offer.kind === 'percent') return `${t('percentOff', { percent: offer.percent ?? 0 })}${offer.maxDiscountPaise ? t('upTo', { amount: formatINR(offer.maxDiscountPaise) }) : ''}`
  if (offer.kind === 'flat') return t('amountOff', { amount: formatINR(offer.flatPaise ?? 0) })
  return t('free', { gift: `${offer.giftQuantity > 1 ? `${offer.giftQuantity} × ` : ''}${offer.giftLabel ?? t('giftFallback')}` })
}

function worksFor(offer: Offer): string {
  const parts = [offer.appliesOneTime && t('oneTime'), offer.appliesTrial && t('trials'), offer.appliesSubscription && `${t('subscriptions')}${offer.minPlanDays ? t('plusDays', { days: offer.minPlanDays }) : ''}`].filter(Boolean)
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
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); reload() }}>{tc('tryAgain')}</Button></div>

  const { offers } = state
  const today = todayInBusinessZone()
  const filtered = offers.filter(item => (status === 'all' || item.status === status) && `${item.title} ${item.titleGu} ${item.code ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (offer: Offer) => {
    if (offer.status === 'inactive') void changeStatus(offer, 'active', t('activated', { name: offer.title }))
    else setDeactivating(offer)
  }

  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('content') }, { label: t('offers') }]} /><h1>{t('offers')}</h1><p className="page-description">{t('description')}</p></div>
      <Link className="primary-button" href="/content/offers/new"><Plus size={16} /> {t('addOffer')}</Link>
    </header>
    <section className="config-section">
      <RecordListToolbar noun={t('noun')} query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>{t('offer')}</TableHead><TableHead>{t('whatItGives')}</TableHead><TableHead>{t('worksFor')}</TableHead><TableHead>{t('minimum')}</TableHead><TableHead>{t('runs')}</TableHead><TableHead>{t('status')}</TableHead><TableHead scope="col" aria-label={t('actions')} /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Link className="table-link" href={`/content/offers/${item.id}/edit`}>{item.title}</Link><small className="cell-note">{item.code ? t('code', { code: item.code }) : t('automatic')}</small></TableCell>
            <TableCell>{describeValue(item)}<small className="cell-note">{OFFER_KIND_LABELS[item.kind]}</small></TableCell>
            <TableCell>{worksFor(item)}</TableCell>
            <TableCell>{item.minOrderPaise ? formatINR(item.minOrderPaise) : t('none')}</TableCell>
            <TableCell>{schedule(item)}</TableCell>
            <TableCell><WindowStatusBadge state={windowState({ status: item.status, startDate: item.startsOn, endDate: item.endsOn }, today)} /></TableCell>
            <TableCell><RecordRowActions name={item.title} active={item.status === 'active'} onEdit={() => router.push(`/content/offers/${item.id}/edit`)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={7}><div className="empty-table">{offers.length ? t('noMatch') : t('noneYet')}{offers.length === 0 && <Link className="text-button" href="/content/offers/new">{t('createFirst')}</Link>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    <DeactivateDialog open={Boolean(deactivating)} noun={t('nounOne')} name={deactivating?.title ?? ''} onCancel={() => setDeactivating(null)} onConfirm={() => { const target = deactivating; setDeactivating(null); if (target) void changeStatus(target, 'inactive', t('deactivated', { name: target.title })) }} consequence={t('deactivateConsequence')} />
  </div>
}
