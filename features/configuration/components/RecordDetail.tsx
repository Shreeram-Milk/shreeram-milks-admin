'use client'

import Link from 'next/link'
import { ArrowLeft, CircleCheck, Clock3, Edit2, TriangleAlert } from 'lucide-react'
import { SummaryRow } from '@/components/configuration/FormField'
import { Button } from '@/components/ui/button'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTimestamp } from '@/lib/business-time'
import type { CutoffRule, DeliverySlot, FeatureKey, FeatureRecord, ServiceArea, SubscriptionRule, TrialPlan } from '../api'
import { FEATURE_LABELS, cutoffPreview, enumText, formatTime, groupPath, humanWindow } from '../format'
import { AreaSetupSteps } from './AreaSetupSteps'
import { PinCodeSection } from './PinCodeSection'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type Props = { feature: FeatureKey; record: FeatureRecord; slots: DeliverySlot[]; onEdit: () => void; onList: () => void; onChanged: () => void }

/** Read-only view of one record, with the PIN codes of a PIN-code area underneath. */
export function RecordDetail({ feature, record, slots, onEdit, onList, onChanged }: Props) {
  const meta = FEATURE_LABELS[feature]
  const slotName = (id: string) => slots.find(slot => slot.id === id)?.name ?? 'Unavailable slot'
  const area = record as ServiceArea
  const cutoff = record as CutoffRule
  return <div className="workspace-page"><header className="page-header page-header-form"><div className="page-title-row"><Link href="#" className="title-back-button" onClick={event => { event.preventDefault(); onList() }} aria-label={`Back to ${meta.plural}`}><ArrowLeft size={19} /></Link><div><PageBreadcrumbs items={[{ label: meta.group }, { label: meta.plural, href: `/${groupPath(feature)}/${feature}` }, { label: record.name }]} /><h1>{record.name}</h1><p className="page-description">{record.description || `Review this ${meta.singular.toLowerCase()} and its relationships.`}</p></div></div><div className="header-actions"><StatusBadge status={record.status}>{enumText(record.status)}</StatusBadge><Button className="primary-button" onClick={onEdit}><Edit2 size={15} /> Edit {meta.singular}</Button></div></header>
    {feature === 'service-areas' && area.coverageType === 'pin_code' && <AreaProgress area={area} slots={slots} onDone={onList} />}
    <section className="detail-grid"><article className="form-card detail-card"><h2>Configuration details</h2>
      {feature === 'trial-plans' && <SummaryRow label="Duration" value={`${(record as TrialPlan).durationDays} days`} />}
      {feature === 'subscription-rules' && <><SummaryRow label="System type" value={enumText((record as SubscriptionRule).systemType)} /><SummaryRow label="Shortest plan" value={`${(record as SubscriptionRule).minDays} days`} /><SummaryRow label="Longest plan" value={`${(record as SubscriptionRule).maxDays} days`} /><SummaryRow label="Quick choices" value={`${((record as SubscriptionRule).lengthOptions ?? []).join(', ')} deliveries`} />{(record as SubscriptionRule).systemType === 'custom_weekdays' && <div className="weekday-preview">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>}</>}
      {feature === 'delivery-slots' && <><SummaryRow label="Delivery window" value={humanWindow(record as DeliverySlot)} /><p className="preview-strip"><Clock3 size={16} /> Deliveries run from {humanWindow(record as DeliverySlot)}.</p></>}
      {feature === 'service-areas' && <><SummaryRow label="Coverage type" value={enumText(area.coverageType)} /><SummaryRow label="Location" value={area.coverageType === 'pan_india' ? 'All India' : [area.city, area.state].filter(Boolean).join(', ')} /><SummaryRow label="PIN codes" value={String(area.pinCount)} /></>}
      {feature === 'cutoff-rules' && cutoff.conditions.map(condition => <SummaryRow key={condition.deliverySlotId} label={slotName(condition.deliverySlotId)} value={`${enumText(condition.dayRelation)} · ${formatTime(condition.cutoffTime)}${condition.cancelDayRelation && condition.cancelTime ? ` · cancel until ${enumText(condition.cancelDayRelation)} ${formatTime(condition.cancelTime)}` : ''}`} />)}
    </article><aside className="form-card"><h2>Record information</h2><SummaryRow label="Status" value={enumText(record.status)} /><SummaryRow label="Last updated" value={formatTimestamp(record.updatedAt)} /></aside></section>
    {feature === 'cutoff-rules' && <section className="section-block detail-section"><div className="section-heading"><div><h2>Ordering deadline previews</h2><p>Plain-language explanation for each delivery slot.</p></div></div><div className="preview-list">{cutoff.conditions.map(condition => <p key={condition.deliverySlotId}>{cutoffPreview(condition, slots.find(slot => slot.id === condition.deliverySlotId))}</p>)}</div></section>}
    {feature === 'service-areas' && area.coverageType === 'pin_code' && <PinCodeSection area={area} slots={slots} onChanged={onChanged} startOpen={area.pinCount === 0} />}
  </div>
}

/** Tells the admin where they are in setting up a PIN-code area, and what is still missing. */
function AreaProgress({ area, slots, onDone }: { area: ServiceArea; slots: DeliverySlot[]; onDone: () => void }) {
  const hasActiveSlot = slots.some(slot => slot.status === 'active')
  return <section aria-label="Setup progress">
    <AreaSetupSteps current={2} pinsDone={area.pinCount > 0} />
    {!hasActiveSlot
      ? <div className="setup-note attention"><TriangleAlert size={18} aria-hidden="true" /><div><strong>Create a delivery slot first</strong>Every PIN code needs at least one delivery slot, and there is no active slot yet. <Link className="text-button" href="/operations/delivery-slots/new">Create a delivery slot</Link></div></div>
      : area.pinCount === 0
        ? <div className="setup-note attention"><TriangleAlert size={18} aria-hidden="true" /><div><strong>Almost done: add the PIN codes you deliver to</strong>This area cannot deliver anywhere until it has at least one PIN code. Use <b>Add from city</b> to pick them from the official list, <b>Add PIN code</b> for one, or <b>Paste many</b> for your own list, and tick the delivery slots each PIN gets.</div></div>
        : <div className="setup-note success"><CircleCheck size={18} aria-hidden="true" /><div><strong>{area.pinCount} PIN {area.pinCount === 1 ? 'code' : 'codes'} added. This area is ready.</strong>You can add or change PIN codes any time on this page.<div className="setup-actions"><Button className="primary-button" onClick={onDone}>Done, back to Service Areas</Button></div></div></div>}
  </section>
}
