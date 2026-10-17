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

export function cutoffPreview(condition: { dayRelation: string; cutoffTime: string; cancelDayRelation?: string | null; cancelTime?: string | null }, slot?: Pick<DeliverySlot, 'name'>) {
  const day = condition.dayRelation === 'previous_day' ? 'tomorrow’s' : 'today’s'
  const ordering = `Orders for ${day} ${slot?.name ?? 'delivery'} delivery must be placed before ${formatTime(condition.cutoffTime)} today.`
  if (!condition.cancelDayRelation || !condition.cancelTime) return `${ordering} Customers can cancel or skip until the same time.`
  const when = condition.cancelDayRelation === condition.dayRelation ? 'the same day' : condition.cancelDayRelation === 'previous_day' ? 'the day before delivery' : 'the delivery day'
  return `${ordering} Customers can cancel or skip until ${formatTime(condition.cancelTime)} (${when}).`
}

/** "2 service areas: Gandhinagar, Surat" for the switch-off warning. */
export const describeUsage = (usage: Usage) => `${usage.count} ${usage.label}${usage.examples.length ? `: ${usage.examples.join(', ')}` : ''}`

/** The usage list the server attaches to an IN_USE refusal, checked rather than trusted. */
export function readUsages(details: unknown): Usage[] {
  if (!Array.isArray(details)) return []
  return details.filter((item): item is Usage => typeof item === 'object' && item !== null && typeof (item as Usage).label === 'string' && typeof (item as Usage).count === 'number')
    .map(item => ({ label: item.label, count: item.count, examples: Array.isArray(item.examples) ? item.examples.filter((example): example is string => typeof example === 'string') : [] }))
}
