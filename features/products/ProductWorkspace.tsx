'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { Button } from '@/components/ui/button'
import { categoryApi } from '../categories/api'
import { configApi } from '../configuration/api'
import { useLoaded, type Loaded } from '../configuration/use-loaded'
import { productApi } from './api'
import { ProductDetail } from './components/ProductDetail'
import { ProductForm, type ProductReferences } from './components/ProductForm'
import { ProductList } from './components/ProductList'

/** Shows the loading skeleton or a retry message until `state` is ready, then hands the data to `children`. */
function WhenReady<T>({ state, reload, children }: { state: Loaded<T>; reload: () => void; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>The product could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={reload}>Try again</Button><Link className="secondary-button" href="/products">Back to products</Link></div>
  return <>{children(state.data)}</>
}

/** The pick-lists a product needs. Each is a handful of records, so they are loaded together in one go. */
async function loadReferences(): Promise<ProductReferences> {
  const [categories, areas, cutoffRules, trialPlans, rules] = await Promise.all([categoryApi.all(), configApi['service-areas'].all(), configApi['cutoff-rules'].all(), configApi['trial-plans'].all(), configApi['subscription-rules'].all()])
  return { categories, areas, cutoffRules, trialPlans, rules }
}

function ProductFormLoader({ id }: { id?: string }) {
  const { state, reload } = useLoaded(async () => {
    const [refs, existing] = await Promise.all([loadReferences(), id ? productApi.get(id) : Promise.resolve(undefined)])
    return { refs, existing }
  }, `form/${id ?? 'new'}`)
  return <WhenReady state={state} reload={reload}>{({ refs, existing }) => <ProductForm existing={existing} refs={refs} />}</WhenReady>
}

function ProductDetailLoader({ id }: { id: string }) {
  const { state, reload } = useLoaded(async () => {
    const [refs, product] = await Promise.all([loadReferences(), productApi.get(id)])
    return { refs, product }
  }, `detail/${id}`)
  return <WhenReady state={state} reload={reload}>{({ refs, product }) => <ProductDetail product={product} refs={refs} />}</WhenReady>
}

/** Products: a list, a detail page and a six-step create / edit form, all loaded from the backend. */
export function ProductWorkspace({ segments = [] }: { segments?: string[] }) {
  if (segments.length === 0) return <ProductList />
  if (segments[0] === 'new') return <ProductFormLoader key="new" />
  const id = segments[0] as string
  if (segments[1] === 'edit') return <ProductFormLoader key={`edit-${id}`} id={id} />
  return <ProductDetailLoader key={`detail-${id}`} id={id} />
}
