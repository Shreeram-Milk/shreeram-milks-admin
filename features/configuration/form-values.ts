import { z } from 'zod'
import { t } from './messages'
import type { CoverageType, CutoffRule, DayRelation, DeliverySlot, FeatureKey, FeatureRecord, RecordStatus, ServiceArea, SubscriptionRule, SubscriptionType, TrialPlan } from './api'

export type FormValues = {
  name: string; description: string; status: RecordStatus; durationDays: number; systemType: SubscriptionType
  /** Typed as "15, 30"; sent as numbers. */
  lengthOptions: string
  minDays: number; maxDays: number
  startTime: string; endTime: string; coverageType: CoverageType; state: string; city: string
  /** `cancelDayRelation` '' means customers can cancel until the cut-off itself. */
  conditions: Array<{ deliverySlotId: string; dayRelation: DayRelation; cutoffTime: string; cancelDayRelation: DayRelation | ''; cancelTime: string }>
}

/** Pick-lists the forms need; each feature uses only the ones it has. */
export type References = { slots: DeliverySlot[] }

/**
 * Quick checks so staff see a mistake before the round trip. The server checks everything again and is the only authority,
 * so a rule is enforced here only when it is cheap to explain on the spot.
 */
/** Minutes from midnight of the delivery day; the day before counts as negative, so an earlier deadline is smaller. */
const deadlineMinutes = (dayRelation: DayRelation, time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return (dayRelation === 'previous_day' ? -1440 : 0) + hours * 60 + minutes
}

export function buildSchema(feature: FeatureKey) {
  return z.object({
    name: z.string().trim().min(1, t('errName')).max(80, t('errNameLong')), description: z.string().trim().max(300, t('errDescriptionLong')), status: z.enum(['active', 'inactive']),
    durationDays: z.coerce.number().optional(), systemType: z.enum(['daily', 'alternate_days', 'custom_weekdays']).optional(), lengthOptions: z.string().optional(), minDays: z.coerce.number().optional(), maxDays: z.coerce.number().optional(), startTime: z.string().optional(), endTime: z.string().optional(),
    coverageType: z.enum(['pin_code', 'state', 'pan_india']).optional(), state: z.string().optional(), city: z.string().optional(),
    conditions: z.array(z.object({ deliverySlotId: z.string(), dayRelation: z.enum(['same_day', 'previous_day']), cutoffTime: z.string(), cancelDayRelation: z.enum(['', 'same_day', 'previous_day']), cancelTime: z.string() })).optional(),
  }).superRefine((value, ctx) => {
    if (feature === 'trial-plans' && (!Number.isInteger(value.durationDays) || !value.durationDays || value.durationDays <= 0)) ctx.addIssue({ code: 'custom', path: ['durationDays'], message: t('errDuration') })
    if (feature === 'subscription-rules') {
      const lengths = parseLengths(value.lengthOptions ?? '')
      if (!lengths) ctx.addIssue({ code: 'custom', path: ['lengthOptions'], message: t('errLengths') })
      const { minDays, maxDays } = value
      if (!Number.isInteger(minDays) || !minDays || minDays < 1 || minDays > 365) ctx.addIssue({ code: 'custom', path: ['minDays'], message: t('errMinDays') })
      if (!Number.isInteger(maxDays) || !maxDays || maxDays < 1 || maxDays > 730) ctx.addIssue({ code: 'custom', path: ['maxDays'], message: t('errMaxDays') })
      else if (minDays && maxDays < minDays) ctx.addIssue({ code: 'custom', path: ['maxDays'], message: t('errMaxBelowMin') })
    }
    if (feature === 'delivery-slots') {
      if (!value.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: t('errStart') })
      if (!value.endTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: t('errEnd') })
      if (value.startTime && value.endTime && value.endTime <= value.startTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: t('errEndBeforeStart') })
    }
    if (feature === 'service-areas') {
      if (value.coverageType !== 'pan_india' && !value.state?.trim()) ctx.addIssue({ code: 'custom', path: ['state'], message: t('errState') })
      if (value.coverageType === 'pin_code' && !value.city?.trim()) ctx.addIssue({ code: 'custom', path: ['city'], message: t('errCity') })
    }
    if (feature === 'cutoff-rules') {
      const conditions = value.conditions ?? []
      if (!conditions.length) ctx.addIssue({ code: 'custom', path: ['conditions'], message: t('errNoConditions') })
      if (new Set(conditions.map(condition => condition.deliverySlotId)).size !== conditions.length) ctx.addIssue({ code: 'custom', path: ['conditions'], message: t('errDuplicateSlot') })
      conditions.forEach((condition, index) => {
        if (!condition.deliverySlotId) ctx.addIssue({ code: 'custom', path: ['conditions', index, 'deliverySlotId'], message: t('errChooseSlot') })
        if (!condition.cutoffTime) ctx.addIssue({ code: 'custom', path: ['conditions', index, 'cutoffTime'], message: t('errCutoffTime') })
        if (condition.cancelDayRelation && !condition.cancelTime) ctx.addIssue({ code: 'custom', path: ['conditions', index, 'cancelTime'], message: t('errCancelTime') })
        if (condition.cancelDayRelation && condition.cancelTime && condition.cutoffTime && deadlineMinutes(condition.cancelDayRelation, condition.cancelTime) > deadlineMinutes(condition.dayRelation, condition.cutoffTime)) ctx.addIssue({ code: 'custom', path: ['conditions', index, 'cancelTime'], message: t('errCancelAfterCutoff') })
      })
    }
  })
}

/** "15, 30" as sorted, unique numbers; null when it is not 1 to 6 whole numbers from 1 to 365. */
export function parseLengths(text: string): number[] | null {
  const parts = text.split(/[,\s]+/).filter(Boolean)
  if (!parts.every(part => /^\d+$/.test(part))) return null
  const lengths = [...new Set(parts.map(Number))].sort((a, b) => a - b)
  return lengths.length >= 1 && lengths.length <= 6 && lengths.every(length => length >= 1 && length <= 365) ? lengths : null
}

export function defaultValues(existing: FeatureRecord | undefined, refs: References): FormValues {
  const plan = existing as TrialPlan | undefined
  const rule = existing as SubscriptionRule | undefined
  const slot = existing as DeliverySlot | undefined
  const area = existing as ServiceArea | undefined
  const cutoff = existing as CutoffRule | undefined
  const activeSlots = refs.slots.filter(item => item.status === 'active')
  return {
    name: existing?.name ?? '', description: existing?.description ?? '', status: existing?.status ?? 'active',
    durationDays: plan?.durationDays ?? 5, systemType: rule?.systemType ?? 'daily', lengthOptions: (rule?.lengthOptions ?? [15, 30]).join(', '), minDays: rule?.minDays ?? 5, maxDays: rule?.maxDays ?? 180,
    startTime: slot?.startTime ?? '06:00', endTime: slot?.endTime ?? '09:00',
    coverageType: area?.coverageType ?? 'pin_code', state: area?.state ?? '', city: area?.city ?? '',
    conditions: cutoff?.conditions?.map(({ deliverySlotId, dayRelation, cutoffTime, cancelDayRelation, cancelTime }) => ({ deliverySlotId, dayRelation, cutoffTime, cancelDayRelation: cancelDayRelation ?? '', cancelTime: cancelTime ?? '' })) ?? [{ deliverySlotId: activeSlots[0]?.id ?? '', dayRelation: 'previous_day', cutoffTime: '15:00', cancelDayRelation: '', cancelTime: '' }],
  }
}

/** What is sent to the server. Only the fields each kind of record has; the server drops anything else. */
export function toPayload(feature: FeatureKey, values: FormValues, confirmRemovePins: boolean): object {
  const base = { name: values.name.trim(), description: values.description.trim(), status: values.status }
  switch (feature) {
    case 'trial-plans': return { ...base, durationDays: Number(values.durationDays) }
    case 'subscription-rules': return { ...base, systemType: values.systemType, lengthOptions: parseLengths(values.lengthOptions) ?? [], minDays: Number(values.minDays), maxDays: Number(values.maxDays) }
    case 'delivery-slots': return { ...base, startTime: values.startTime, endTime: values.endTime }
    case 'service-areas': return { ...base, coverageType: values.coverageType, state: values.coverageType === 'pan_india' ? '' : values.state.trim(), city: values.coverageType === 'pin_code' ? values.city.trim() : '', confirmRemovePins }
    case 'cutoff-rules': return { ...base, conditions: values.conditions.map(({ cancelDayRelation, cancelTime, ...condition }) => ({ ...condition, cancelDayRelation: cancelDayRelation || null, cancelTime: cancelDayRelation ? cancelTime : null })) }
  }
}
