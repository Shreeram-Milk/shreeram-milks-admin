'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { bannerApi } from './api'
import { BannerForm, BannerNotFound } from './components/BannerForm'
import { isBannerType, type Banner, type BannerType } from './types'

/** `/content/banners/new?type=…`: a blank banner of the type chosen on the tab it was opened from. */
export function NewBanner() {
  const requested = useSearchParams().get('type')
  const type: BannerType = isBannerType(requested) ? requested : 'promotion'
  const [nextSortOrder, setNextSortOrder] = useState<number | null>(null)

  // New banners go to the end of their type by default. If the list can't be read, the form still opens with 1.
  useEffect(() => {
    let cancelled = false
    bannerApi.list().then(
      banners => { if (!cancelled) setNextSortOrder(Math.max(0, ...banners.filter(item => item.type === type).map(item => item.sortOrder)) + 1) },
      () => { if (!cancelled) setNextSortOrder(1) },
    )
    return () => { cancelled = true }
  }, [type])

  if (nextSortOrder === null) return <PageSkeleton />
  return <BannerForm key={type} banner={null} type={type} nextSortOrder={nextSortOrder} />
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; banner: Banner }

/** `/content/banners/<id>/edit`: loads the banner, then shows its form. The type cannot change; it decides which tab it lives in. */
export function EditBanner({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    bannerApi.get(id).then(
      banner => { if (!cancelled) setState({ status: 'ready', banner }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [id])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <BannerNotFound message={state.message} />
  return <BannerForm key={state.banner.id} banner={state.banner} type={state.banner.type} />
}
