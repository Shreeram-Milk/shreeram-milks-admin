'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { Button } from '@/components/ui/button'
import { configApi, type DeliverySlot, type FeatureKey, type FeatureRecord, type ServiceArea } from './api'
import { FEATURE_LABELS, groupPath } from './format'
import type { References } from './form-values'
import { RecordDetail } from './components/RecordDetail'
import { RecordForm } from './components/RecordForm'
import { RecordList } from './components/RecordList'
import { useLoaded, type Loaded } from './use-loaded'

/** After saving, a PIN-code area continues to its PIN codes; the others have more to review on their page, or are finished. */
const goesToDetail = (feature: FeatureKey, saved: FeatureRecord) =>
  feature === 'cutoff-rules' || (feature === 'service-areas' && (saved as ServiceArea).coverageType === 'pin_code')

const isFeature = (value: string): value is FeatureKey => value in FEATURE_LABELS

/** Shows the loading skeleton or a retry message until `state` is ready, then hands the data to `children`. */
function WhenReady<T>({ state, reload, what, children }: { state: Loaded<T>; reload: () => void; what: string; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{what} could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={reload}>Try again</Button></div>
  return <>{children(state.data)}</>
}

/** The pick-lists a feature's form needs. Features that need none load nothing. */
async function loadReferences(feature: FeatureKey): Promise<References> {
  const needsSlots = feature === 'cutoff-rules' || feature === 'service-areas'
  return { slots: needsSlots ? await configApi['delivery-slots'].all() : [] }
}

function RecordFormLoader({ feature, id, section }: { feature: FeatureKey; id?: string; section: string }) {
  const router = useRouter()
  const { state, reload } = useLoaded(async () => {
    const [refs, existing] = await Promise.all([loadReferences(feature), id ? configApi[feature].get(id) : Promise.resolve(undefined)])
    return { refs, existing: existing as FeatureRecord | undefined }
  }, `${feature}/${id ?? 'new'}`)
  const listHref = `/${section}/${feature}`
  return <WhenReady state={state} reload={reload} what={FEATURE_LABELS[feature].singular}>{({ refs, existing }) =>
    <RecordForm feature={feature} existing={existing} refs={refs} onCancel={() => router.push(listHref)} onSaved={saved => router.push(goesToDetail(feature, saved) ? `${listHref}/${saved.id}` : listHref)} />}</WhenReady>
}

function RecordDetailLoader({ feature, id, section }: { feature: FeatureKey; id: string; section: string }) {
  const router = useRouter()
  const { state, reload } = useLoaded(async () => {
    const needsSlots = feature === 'cutoff-rules' || feature === 'service-areas'
    const [record, slots] = await Promise.all([configApi[feature].get(id) as Promise<FeatureRecord>, needsSlots ? configApi['delivery-slots'].all() : Promise.resolve<DeliverySlot[]>([])])
    return { record, slots }
  }, `${feature}/${id}`)
  const listHref = `/${section}/${feature}`
  return <WhenReady state={state} reload={reload} what={FEATURE_LABELS[feature].singular}>{({ record, slots }) =>
    <RecordDetail feature={feature} record={record} slots={slots} onEdit={() => router.push(`${listHref}/${id}/edit`)} onList={() => router.push(listHref)} onChanged={reload} />}</WhenReady>
}

/** The five delivery-setup lists, each loaded from the backend: a list, a detail page, and a create / edit form. */
export function ConfigurationWorkspace({ segments }: { segments: string[]; section: 'configuration' | 'operations' }) {
  const feature = segments[0] ?? ''
  if (!isFeature(feature)) return <div className="workspace-page"><div className="empty-state"><h1>Configuration not found</h1><p>Choose an item from the navigation to continue.</p><Link className="secondary-button" href="/">Back to dashboard</Link></div></div>
  const mode = segments[1] === 'new' ? 'new' : segments[2] === 'edit' ? 'edit' : segments[1] ? 'detail' : 'list'
  const id = segments[1] && mode !== 'new' ? segments[1] : undefined
  // A record always lives under its own section, whichever sidebar link led here.
  const home = groupPath(feature)
  if (mode === 'new') return <RecordFormLoader key={`${feature}-new`} feature={feature} section={home} />
  if (mode === 'edit' && id) return <RecordFormLoader key={`${feature}-${id}-edit`} feature={feature} id={id} section={home} />
  if (mode === 'detail' && id) return <RecordDetailLoader key={`${feature}-${id}`} feature={feature} id={id} section={home} />
  return <RecordList key={feature} feature={feature} />
}
