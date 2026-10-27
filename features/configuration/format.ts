import type { DeliverySlot, FeatureKey, Usage } from './api'

export const FEATURE_LABELS: Record<FeatureKey, { singular: string; plural: string; group: 'Configuration' | 'Operations'; description: string }> = {
  'trial-plans': { singular: 'Trial plan', plural: 'Trial plans', group: 'Configuration', description: 'Small starter offers a new customer can try.' },
  'subscription-rules': { singular: 'Subscription rule', plural: 'Subscription rules', group: 'Configuration', description: 'How often customers can choose to get repeat deliveries.' },
  'delivery-slots': { singular: 'Delivery slot', plural: 'Delivery slots', group: 'Operations', description: 'The time windows customers pick for delivery, like Morning or Evening.' },
  'service-areas': { singular: 'Delivery area', plural: 'Delivery areas', group: 'Operations', description: 'Where you deliver: a list of PIN codes (with the delivery slots each PIN gets), a whole state, or all of India.' },
  'cutoff-rules': { singular: 'Order-by time', plural: 'Order-by times', group: 'Operations', description: 'The last time customers can order (and skip) for each delivery slot. Example: order by 9 PM the day before for Morning.' },
}

export const groupPath = (feature: FeatureKey) => FEATURE_LABELS[feature].group === 'Operations' ? 'operations' : 'configuration'
export const enumText = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
export const formatTime = (time: string) => { const [hours = 0, minutes = 0] = time.split(':').map(Number); return `${(hours % 12) || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}` }
export const humanWindow = (slot?: Pick<DeliverySlot, 'startTime' | 'endTime'>) => slot ? `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}` : 'Unavailable slot'

/** The part of the day a time falls in, so a list of times is easy to scan. */
export const partOfDay = (time: string): string => {
  const hours = Number(time.split(':')[0] ?? 0)
  return hours >= 5 && hours < 12 ? 'Morning' : hours >= 12 && hours < 17 ? 'Afternoon' : hours >= 17 && hours < 21 ? 'Evening' : 'Night'
}

/** Every half hour of the day as "9:00 PM · Evening", so staff pick a time instead of typing one. `latest` hides times after it; a saved odd time stays in the list. */
export function timeChoices(current: string, latest?: string): Array<{ value: string; label: string }> {
  const times: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) times.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
  if (current && !times.includes(current)) times.push(current)
  return times.filter(time => !latest || time <= latest || time === current).sort().map(time => ({ value: time, label: `${formatTime(time)} · ${partOfDay(time)}` }))
}

/** "on the day before delivery" / "on the same day as delivery". */
const dayPhrase = (dayRelation: string) => (dayRelation === 'previous_day' ? 'on the day before delivery' : 'on the same day as delivery')

/** One plain sentence for staff: who can order until when, to get which delivery window. The window is named by its time, never only by its name. */
export function cutoffPreview(condition: { dayRelation: string; cutoffTime: string; cancelDayRelation?: string | null; cancelTime?: string | null }, slot?: Partial<Pick<DeliverySlot, 'name' | 'startTime' | 'endTime'>>) {
  const window = slot?.startTime && slot.endTime ? `delivery between ${humanWindow({ startTime: slot.startTime, endTime: slot.endTime })}` : `${slot?.name ?? 'the'} delivery`
  const ordering = `To get ${window}, a customer must order before ${formatTime(condition.cutoffTime)} ${dayPhrase(condition.dayRelation)}.`
  if (!condition.cancelDayRelation || !condition.cancelTime) return `${ordering} They can cancel or skip until that same time.`
  return `${ordering} They can cancel or skip until ${formatTime(condition.cancelTime)} ${dayPhrase(condition.cancelDayRelation)}.`
}

/** "2 service areas: Gandhinagar, Surat" for the switch-off warning. */
export const describeUsage = (usage: Usage) => `${usage.count} ${usage.label}${usage.examples.length ? `: ${usage.examples.join(', ')}` : ''}`

/** The usage list the server attaches to an IN_USE refusal, checked rather than trusted. */
export function readUsages(details: unknown): Usage[] {
  if (!Array.isArray(details)) return []
  return details.filter((item): item is Usage => typeof item === 'object' && item !== null && typeof (item as Usage).label === 'string' && typeof (item as Usage).count === 'number')
    .map(item => ({ label: item.label, count: item.count, examples: Array.isArray(item.examples) ? item.examples.filter((example): example is string => typeof example === 'string') : [] }))
}
