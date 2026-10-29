import type { DeliverySlot, FeatureKey, Usage } from './api'
import { t, type ConfigKey } from './messages'

type FeatureText = { readonly singular: string; readonly plural: string; readonly group: string; readonly description: string; section: 'configuration' | 'operations' }
/** A feature's words, read when used so they follow the admin's language. `section` is the part of the address it lives under. */
const featureText = (singular: ConfigKey, plural: ConfigKey, description: ConfigKey, section: FeatureText['section']): FeatureText => ({
  get singular() { return t(singular) }, get plural() { return t(plural) }, get description() { return t(description) },
  get group() { return t(section === 'operations' ? 'groupOperations' : 'groupConfiguration') }, section,
})

export const FEATURE_LABELS: Record<FeatureKey, FeatureText> = {
  'trial-plans': featureText('trialPlan', 'trialPlans', 'trialPlansDescription', 'configuration'),
  'subscription-rules': featureText('subscriptionRule', 'subscriptionRules', 'subscriptionRulesDescription', 'configuration'),
  'delivery-slots': featureText('deliverySlot', 'deliverySlots', 'deliverySlotsDescription', 'operations'),
  'service-areas': featureText('deliveryArea', 'deliveryAreas', 'deliveryAreasDescription', 'operations'),
  'cutoff-rules': featureText('cutoffRule', 'cutoffRules', 'cutoffRulesDescription', 'operations'),
}

export const groupPath = (feature: FeatureKey) => FEATURE_LABELS[feature].section
/** Stored values shown as words: statuses, kinds of coverage, schedules and days. An unknown value reads as Title Case. */
const ENUM_WORDS: Record<string, ConfigKey> = {
  active: 'statusActive', inactive: 'statusInactive', pin_code: 'coveragePin', state: 'coverageState', pan_india: 'coveragePanIndia',
  daily: 'scheduleDaily', alternate_days: 'scheduleAlternate', custom_weekdays: 'scheduleCustom', previous_day: 'relationPrevious', same_day: 'relationSame',
}
export const enumText = (value: string) => { const key = ENUM_WORDS[value]; return key ? t(key) : value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) }
export const formatTime = (time: string) => { const [hours = 0, minutes = 0] = time.split(':').map(Number); return `${(hours % 12) || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}` }
export const humanWindow = (slot?: Pick<DeliverySlot, 'startTime' | 'endTime'>) => slot ? `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}` : t('unavailableSlot')

/** The part of the day a time falls in, so a list of times is easy to scan. */
export const partOfDay = (time: string): string => {
  const hours = Number(time.split(':')[0] ?? 0)
  return t(hours >= 5 && hours < 12 ? 'morning' : hours >= 12 && hours < 17 ? 'afternoon' : hours >= 17 && hours < 21 ? 'evening' : 'night')
}

/** Every half hour of the day as "9:00 PM · Evening", so staff pick a time instead of typing one. `latest` hides times after it; a saved odd time stays in the list. */
export function timeChoices(current: string, latest?: string): Array<{ value: string; label: string }> {
  const times: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) times.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
  if (current && !times.includes(current)) times.push(current)
  return times.filter(time => !latest || time <= latest || time === current).sort().map(time => ({ value: time, label: `${formatTime(time)} · ${partOfDay(time)}` }))
}

/** "on the day before delivery" / "on the same day as delivery". */
const dayPhrase = (dayRelation: string) => t(dayRelation === 'previous_day' ? 'dayBefore' : 'sameDay')

/** One plain sentence for staff: who can order until when, to get which delivery window. The window is named by its time, never only by its name. */
export function cutoffPreview(condition: { dayRelation: string; cutoffTime: string; cancelDayRelation?: string | null; cancelTime?: string | null }, slot?: Partial<Pick<DeliverySlot, 'name' | 'startTime' | 'endTime'>>) {
  const window = slot?.startTime && slot.endTime ? t('deliveryBetween', { window: humanWindow({ startTime: slot.startTime, endTime: slot.endTime }) }) : slot?.name ? t('namedDelivery', { name: slot.name }) : t('theDelivery')
  const ordering = t('orderingSentence', { window, time: formatTime(condition.cutoffTime), day: dayPhrase(condition.dayRelation) })
  if (!condition.cancelDayRelation || !condition.cancelTime) return `${ordering}${t('cancelSameTime')}`
  return `${ordering}${t('cancelUntil', { time: formatTime(condition.cancelTime), day: dayPhrase(condition.cancelDayRelation) })}`
}

/** "2 service areas: Gandhinagar, Surat" for the switch-off warning. */
export const describeUsage = (usage: Usage) => `${usage.count} ${usage.label}${usage.examples.length ? `: ${usage.examples.join(', ')}` : ''}`

/** The usage list the server attaches to an IN_USE refusal, checked rather than trusted. */
export function readUsages(details: unknown): Usage[] {
  if (!Array.isArray(details)) return []
  return details.filter((item): item is Usage => typeof item === 'object' && item !== null && typeof (item as Usage).label === 'string' && typeof (item as Usage).count === 'number')
    .map(item => ({ label: item.label, count: item.count, examples: Array.isArray(item.examples) ? item.examples.filter((example): example is string => typeof example === 'string') : [] }))
}
