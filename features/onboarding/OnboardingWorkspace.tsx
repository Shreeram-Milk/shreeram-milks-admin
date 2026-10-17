'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Edit2, ImageOff, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { onboardingApi } from './api'
import { SlideDialog } from './components/SlideDialog'
import { MAX_ACTIVE_SLIDES, type OnboardingSlideRecord } from './types'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; slides: OnboardingSlideRecord[] }

/** The first-run introduction: one row per slide, each with its own picture, headline and text. */
export function OnboardingWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // `undefined` = editor closed, `null` = adding, a slide = editing it.
  const [editing, setEditing] = useState<OnboardingSlideRecord | null | undefined>(undefined)

  // Bumping this reloads the list from the backend; the effect ignores an answer that arrives after a newer request.
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(count => count + 1)
  useEffect(() => {
    let cancelled = false
    onboardingApi.list().then(
      slides => { if (!cancelled) setState({ status: 'ready', slides }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try { await action(); if (success) toast.success(success) } catch (failure) { toast.error(describeApiError(failure)) }
    reload()
  }

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>Onboarding could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); reload() }}>Try again</Button></div>

  const { slides } = state
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Onboarding' }]} /><h1>Onboarding</h1><p className="page-description">The slides new customers see when they first open the app. Each slide has its own picture, headline and text. Up to {MAX_ACTIVE_SLIDES} can be active; the app keeps a built-in introduction as a fallback.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={15} /> Add Slide</Button>
    </header>
    <section className="product-list-section">
      {slides.length === 0
        ? <div className="product-state"><strong>No slides yet</strong><span>Add a slide to replace the app’s built-in introduction.</span></div>
        : <div className="table-card product-list-table-card"><Table className="config-table">
          <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Picture</TableHead><TableHead>Slide</TableHead><TableHead>Gujarati</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
          <TableBody>{slides.map((slide, index) => <TableRow key={slide.id}>
            <TableCell><span className="reorder-cell">{slide.sortOrder}
              <Button variant="ghost" size="icon" className="row-edit-action" aria-label={`Move ${slide.titleEn} up`} disabled={index === 0} onClick={() => void run(() => onboardingApi.move(slide.id, 'up'))}><ArrowUp size={14} /></Button>
              <Button variant="ghost" size="icon" className="row-edit-action" aria-label={`Move ${slide.titleEn} down`} disabled={index === slides.length - 1} onClick={() => void run(() => onboardingApi.move(slide.id, 'down'))}><ArrowDown size={14} /></Button></span></TableCell>
            <TableCell>{slide.imageUrl
              // A plain <img>: a short-lived signed link, which next/image cannot optimise.
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={slide.imageUrl} alt="" className="slide-thumb" />
              : <ImageOff size={18} aria-label="Picture missing" />}</TableCell>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(slide)}>{slide.titleEn}</Button><small className="cell-note">{slide.descriptionEn}</small></TableCell>
            <TableCell>{slide.titleGu && slide.descriptionGu ? 'Added' : 'Missing'}</TableCell>
            <TableCell><StatusBadge status={slide.status}>{slide.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge></TableCell>
            <TableCell><div className="row-actions">
              <Button variant="ghost" size="icon" className="row-edit-action" aria-label={`Edit ${slide.titleEn}`} onClick={() => setEditing(slide)}><Edit2 size={15} /></Button>
            </div></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>}
    </section>
    {editing !== undefined && <SlideDialog key={editing?.id ?? 'new'} slide={editing} onClose={() => setEditing(undefined)} onDone={reload} />}
  </div>
}
