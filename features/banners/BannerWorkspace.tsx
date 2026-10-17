'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { DeactivateDialog, RecordListToolbar, RecordRowActions } from '@/components/shared/RecordListParts'
import { WindowStatusBadge } from '@/components/shared/WindowStatusBadge'
import { windowState } from '@/lib/active-window'
import { describeApiError } from '@/lib/api-errors'
import { formatDisplayDate, todayInBusinessZone } from '@/lib/business-time'
import { bannerApi } from './api'
import { useLinkTargets } from './links'
import { BANNER_AUDIENCE_LABELS, BANNER_TAB_LABELS, BANNER_TYPES, BANNER_TYPE_DESCRIPTIONS, BANNER_TYPE_LABELS, isBannerType, type Banner, type BannerType } from './types'

const schedule = (banner: Banner) => {
  if (!banner.startDate && !banner.endDate) return 'Always'
  return `${banner.startDate ? formatDisplayDate(banner.startDate) : 'Now'} – ${banner.endDate ? formatDisplayDate(banner.endDate) : 'No end'}`
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; banners: Banner[] }

/** Banners, one tab per type. Each tab is its own list, and adding or editing happens on its own page. */
export function BannerWorkspace() {
  const router = useRouter()
  const requested = useSearchParams().get('type')
  // The tab lives in the URL, so a link or a refresh lands on the same tab.
  const activeType: BannerType = isBannerType(requested) ? requested : 'promotion'

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const linkTargets = useLinkTargets()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [deactivating, setDeactivating] = useState<Banner | null>(null)

  // Bumping this reloads the list from the backend; the effect ignores an answer that arrives after a newer request.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(count => count + 1)
  useEffect(() => {
    let cancelled = false
    bannerApi.list().then(
      banners => { if (!cancelled) setState({ status: 'ready', banners }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  const changeStatus = async (banner: Banner, next: Banner['status'], success: string) => {
    try { await bannerApi.setStatus(banner.id, next); toast.success(success) } catch (failure) { toast.error(describeApiError(failure)) }
    reload()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Banners could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); reload() }}>Try again</Button></div>

  const { banners } = state
  const today = todayInBusinessZone()
  const inTab = banners.filter(item => item.type === activeType)
  const filtered = inTab.filter(item => (status === 'all' || item.status === status) && `${item.titleEn} ${item.titleGu}`.toLowerCase().includes(query.trim().toLowerCase()))
  const label = BANNER_TYPE_LABELS[activeType]
  const switchTab = (type: string) => { setQuery(''); setStatus('all'); router.replace(`/content/banners?type=${type}`) }
  const toggle = (banner: Banner) => {
    if (banner.status === 'inactive') void changeStatus(banner, 'active', `${label} activated.`)
    else setDeactivating(banner)
  }

  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Banners' }]} /><h1>Banners</h1><p className="page-description">Promotions and notices shown on the customer app’s home screen. Each type has its own tab.</p></div>
      <Link className="primary-button" href={`/content/banners/new?type=${activeType}`}><Plus size={16} /> Add {label}</Link>
    </header>
    <Tabs value={activeType} onValueChange={switchTab}>
      <TabsList aria-label="Banner types">
        {BANNER_TYPES.map(type => <TabsTrigger key={type} value={type}>{BANNER_TAB_LABELS[type]} <span className="tab-count">{banners.filter(item => item.type === type).length}</span></TabsTrigger>)}
      </TabsList>
      <TabsContent value={activeType}>
        <section className="config-section">
          <p className="product-hint">{BANNER_TYPE_DESCRIPTIONS[activeType]}</p>
          <RecordListToolbar noun={BANNER_TAB_LABELS[activeType].toLowerCase()} query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
          <div className="table-card"><div className="table-scroll"><Table>
            <TableHeader><TableRow><TableHead>Banner</TableHead><TableHead>Shown to</TableHead><TableHead>Opens</TableHead><TableHead>Runs</TableHead><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
            <TableBody>
              {filtered.map(item => <TableRow key={item.id}>
                <TableCell><Link className="table-link" href={`/content/banners/${item.id}/edit`}>{item.titleEn}</Link><small className="cell-note">{item.titleGu ? 'English + Gujarati' : 'English only'}</small></TableCell>
                <TableCell>{BANNER_AUDIENCE_LABELS[item.audience]}</TableCell>
                <TableCell>{linkTargets.label(item)}</TableCell>
                <TableCell>{schedule(item)}</TableCell>
                <TableCell>{item.sortOrder}</TableCell>
                <TableCell><WindowStatusBadge state={windowState(item, today)} /></TableCell>
                <TableCell><RecordRowActions name={item.titleEn} active={item.status === 'active'} onEdit={() => router.push(`/content/banners/${item.id}/edit`)} onToggle={() => toggle(item)} /></TableCell>
              </TableRow>)}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7}><div className="empty-table">{inTab.length ? `No ${BANNER_TAB_LABELS[activeType].toLowerCase()} match your search and filters.` : `No ${BANNER_TAB_LABELS[activeType].toLowerCase()} yet.`}{inTab.length === 0 && <Link className="text-button" href={`/content/banners/new?type=${activeType}`}>Add the first {label.toLowerCase()}</Link>}</div></TableCell></TableRow>}
            </TableBody>
          </Table></div></div>
        </section>
      </TabsContent>
    </Tabs>
    <DeactivateDialog open={Boolean(deactivating)} noun={label.toLowerCase()} name={deactivating?.titleEn ?? ''} onCancel={() => setDeactivating(null)} onConfirm={() => { const target = deactivating; setDeactivating(null); if (target) void changeStatus(target, 'inactive', `${label} deactivated.`) }} consequence="It disappears from the customer app’s home screen straight away. You can activate it again any time." />
  </div>
}
