'use client'

import Link from 'next/link'
import { ArrowLeft, CircleCheck, Clock3, Edit2, TriangleAlert } from 'lucide-react'
import { SummaryRow } from '@/components/configuration/FormField'
import { Button } from '@/components/ui/button'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatTimestamp } from '@/lib/business-time'
import type { CutoffRule, DeliverySlot, FeatureRecord, ServiceArea, SubscriptionRule, TrialPlan } from '../api'
import { FEATURE_LABELS, cutoffPreview, enumText, formatTime, groupPath, humanWindow } from '../format'
import { AreaSetupSteps } from './AreaSetupSteps'
import { PinCodeSection } from './PinCodeSection'
import { t } from '../messages'

type Props = { feature: keyof typeof FEATURE_LABELS; record: FeatureRecord; slots: DeliverySlot[]; onEdit: () => void; onList: () => void; onChanged: () => void }

/** Read-only view of one record, with the PIN codes of a PIN-code area underneath. */
export function RecordDetail({ feature, record, slots, onEdit, onList, onChanged }: Props) {
  const meta = FEATURE_LABELS[feature]
  const slotName = (id: string) => slots.find(slot => slot.id === id)?.name ?? t('unavailableSlot')
  const area = record as ServiceArea
  const cutoff = record as CutoffRule
  return <div className="workspace-page"><header className="page-header page-header-form"><div className="page-title-row"><Link href="#" className="title-back-button" onClick={event => { event.preventDefault(); onList() }} aria-label={t('backTo', { noun: meta.plural })}><ArrowLeft size={19} /></Link><div><PageBreadcrumbs items={[{ label: meta.group }, { label: meta.plural, href: `/${groupPath(feature)}/${feature}` }, { label: record.name }]} /><h1>{record.name}</h1><p className="page-description">{record.description || t('reviewThis', { noun: meta.singular.toLowerCase() })}</p></div></div><div className="header-actions"><StatusBadge status={record.status}>{enumText(record.status)}</StatusBadge><Button className="primary-button" onClick={onEdit}><Edit2 size={15} /> {t('editNoun', { noun: meta.singular })}</Button></div></header>
    {feature === 'service-areas' && area.coverageType === 'pin_code' && <AreaProgress area={area} slots={slots} onDone={onList} />}
    <section className="detail-grid"><article className="form-card detail-card"><h2>{t('details')}</h2>
      {feature === 'trial-plans' && <SummaryRow label={t('duration')} value={t('daysCount', { count: (record as TrialPlan).durationDays })} />}
      {feature === 'subscription-rules' && <><SummaryRow label={t('systemType')} value={enumText((record as SubscriptionRule).systemType)} /><SummaryRow label={t('shortestPlan')} value={t('daysCount', { count: (record as SubscriptionRule).minDays })} /><SummaryRow label={t('longestPlan')} value={t('daysCount', { count: (record as SubscriptionRule).maxDays })} /><SummaryRow label={t('quickChoices')} value={t('deliveriesCount', { list: ((record as SubscriptionRule).lengthOptions ?? []).join(', ') })} />{(record as SubscriptionRule).systemType === 'custom_weekdays' && <div className="weekday-preview">{t('weekdaysAll').split(' · ').map(day => <span key={day}>{day}</span>)}</div>}</>}
      {feature === 'delivery-slots' && <><SummaryRow label={t('deliveryWindow')} value={humanWindow(record as DeliverySlot)} /><p className="preview-strip"><Clock3 size={16} /> {t('runsFrom', { window: humanWindow(record as DeliverySlot) })}</p></>}
      {feature === 'service-areas' && <><SummaryRow label={t('coverageType')} value={enumText(area.coverageType)} /><SummaryRow label={t('location')} value={area.coverageType === 'pan_india' ? t('allIndia') : [area.city, area.state].filter(Boolean).join(', ')} /><SummaryRow label={t('pinCodes')} value={String(area.pinCount)} /></>}
      {feature === 'cutoff-rules' && cutoff.conditions.map(condition => <SummaryRow key={condition.deliverySlotId} label={slotName(condition.deliverySlotId)} value={`${enumText(condition.dayRelation)} · ${formatTime(condition.cutoffTime)}${condition.cancelDayRelation && condition.cancelTime ? t('cancelUntilShort', { day: enumText(condition.cancelDayRelation), time: formatTime(condition.cancelTime) }) : ''}`} />)}
    </article><aside className="form-card"><h2>{t('recordInfo')}</h2><SummaryRow label={t('status')} value={enumText(record.status)} /><SummaryRow label={t('lastUpdated')} value={formatTimestamp(record.updatedAt)} /></aside></section>
    {feature === 'cutoff-rules' && <section className="section-block detail-section"><div className="section-heading"><div><h2>{t('previews')}</h2><p>{t('previewsIntro')}</p></div></div><div className="preview-list">{cutoff.conditions.map(condition => <p key={condition.deliverySlotId}>{cutoffPreview(condition, slots.find(slot => slot.id === condition.deliverySlotId))}</p>)}</div></section>}
    {feature === 'service-areas' && area.coverageType === 'pin_code' && <PinCodeSection area={area} slots={slots} onChanged={onChanged} startOpen={area.pinCount === 0} />}
  </div>
}

/** Tells the admin where they are in setting up a PIN-code area, and what is still missing. */
function AreaProgress({ area, slots, onDone }: { area: ServiceArea; slots: DeliverySlot[]; onDone: () => void }) {
  const hasActiveSlot = slots.some(slot => slot.status === 'active')
  return <section aria-label={t('setupProgress')}>
    <AreaSetupSteps current={2} pinsDone={area.pinCount > 0} />
    {!hasActiveSlot
      ? <div className="setup-note attention"><TriangleAlert size={18} aria-hidden="true" /><div><strong>{t('createSlotFirst')}</strong>{t('createSlotFirstDetail')} <Link className="text-button" href="/operations/delivery-slots/new">{t('createSlot')}</Link></div></div>
      : area.pinCount === 0
        ? <div className="setup-note attention"><TriangleAlert size={18} aria-hidden="true" /><div><strong>{t('almostDone')}</strong>{t('almostDoneDetail')}</div></div>
        : <div className="setup-note success"><CircleCheck size={18} aria-hidden="true" /><div><strong>{t(area.pinCount === 1 ? 'areaReadyOne' : 'areaReadyMany', { count: area.pinCount })}</strong>{t('changeAnyTime')}<div className="setup-actions"><Button className="primary-button" onClick={onDone}>{t('doneBack')}</Button></div></div></div>}
  </section>
}
