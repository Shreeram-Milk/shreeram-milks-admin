'use client'

import { useEffect, useState } from 'react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { offerApi } from './api'
import { OfferForm, OfferNotFound } from './components/OfferForm'
import type { Offer } from './types'

/** `/content/offers/new`: a blank offer. */
export function NewOffer() {
  return <OfferForm offer={null} />
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; offer: Offer }

/** `/content/offers/<id>/edit`: loads the offer, then shows its form. */
export function EditOffer({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    offerApi.get(id).then(
      offer => { if (!cancelled) setState({ status: 'ready', offer }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [id])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <OfferNotFound message={state.message} />
  return <OfferForm key={state.offer.id} offer={state.offer} />
}
