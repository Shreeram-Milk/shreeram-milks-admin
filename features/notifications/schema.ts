import { z } from 'zod'
import type { Audience } from './api'

export const TITLE_MAX = 60
export const BODY_MAX = 240
export const MAX_PIN_CODES = 50
export const MAX_CHOSEN_CUSTOMERS = 200

const title = z.string().trim().min(1, 'Enter a title.').max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`)
const body = z.string().trim().min(1, 'Enter the message.').max(BODY_MAX, `Keep the message under ${BODY_MAX} characters.`)
const titleGujarati = z.string().trim().max(TITLE_MAX, `Keep the title under ${TITLE_MAX} characters.`)
const bodyGujarati = z.string().trim().max(BODY_MAX, `Keep the message under ${BODY_MAX} characters.`)

/** The wording of an automatic message. The server also checks it only uses details that message knows. */
export const templateSchema = z.object({ title, titleGujarati, body, bodyGujarati, enabled: z.boolean() })
export type TemplateFormValues = z.infer<typeof templateSchema>

/** PIN codes typed as text, separated by commas, spaces or new lines: 6 digits each, no duplicates. */
export function parsePinCodes(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean))]
}

export const AUDIENCE_TYPES = ['all', 'filter', 'customers'] as const
export type AudienceType = (typeof AUDIENCE_TYPES)[number]
export type SubscriptionFilter = 'any' | 'with' | 'without'

export const broadcastSchema = z.object({
  title, titleGujarati, body, bodyGujarati,
  /** Tapping the message opens the Offers page. */
  opensOffers: z.boolean(),
  audienceType: z.enum(AUDIENCE_TYPES),
  customerType: z.enum(['', 'prepaid', 'credit']),
  pinCodes: z.string().max(600, 'That is too many PIN codes.'),
  subscription: z.enum(['any', 'with', 'without']),
  customerIds: z.array(z.string()).max(MAX_CHOSEN_CUSTOMERS, `Choose at most ${MAX_CHOSEN_CUSTOMERS} customers.`),
}).superRefine((value, context) => {
  if (value.audienceType === 'filter') {
    const pins = parsePinCodes(value.pinCodes)
    if (pins.some(pin => !/^[1-9][0-9]{5}$/.test(pin))) context.addIssue({ code: 'custom', path: ['pinCodes'], message: 'Use 6-digit PIN codes, separated by commas or spaces.' })
    else if (pins.length > MAX_PIN_CODES) context.addIssue({ code: 'custom', path: ['pinCodes'], message: `Use at most ${MAX_PIN_CODES} PIN codes.` })
    else if (!value.customerType && pins.length === 0 && value.subscription === 'any') context.addIssue({ code: 'custom', path: ['customerType'], message: 'Choose at least one thing to narrow the group, or send to everyone.' })
  }
  if (value.audienceType === 'customers' && value.customerIds.length === 0) context.addIssue({ code: 'custom', path: ['customerIds'], message: 'Choose at least one customer.' })
})
export type BroadcastFormValues = z.infer<typeof broadcastSchema>

export const blankBroadcast: BroadcastFormValues = { title: '', titleGujarati: '', body: '', bodyGujarati: '', opensOffers: false, audienceType: 'all', customerType: '', pinCodes: '', subscription: 'any', customerIds: [] }

/** The audience the server understands, from what staff filled in. Only the part for the chosen kind of audience is sent. */
export function toAudience(values: Pick<BroadcastFormValues, 'audienceType' | 'customerType' | 'pinCodes' | 'subscription' | 'customerIds'>): Audience {
  if (values.audienceType === 'customers') return { type: 'customers', customerIds: values.customerIds }
  if (values.audienceType === 'all') return { type: 'all' }
  const pins = parsePinCodes(values.pinCodes)
  return {
    type: 'filter',
    ...(values.customerType ? { customerType: values.customerType } : {}),
    ...(pins.length > 0 ? { pinCodes: pins } : {}),
    ...(values.subscription === 'with' ? { hasActiveSubscription: true } : values.subscription === 'without' ? { hasActiveSubscription: false } : {}),
  }
}

/** The group in plain words, for the history list. */
export function describeAudience(audience: Audience): string {
  if (audience.type === 'all') return 'Everyone'
  if (audience.type === 'customers') return `${audience.customerIds.length} chosen ${audience.customerIds.length === 1 ? 'customer' : 'customers'}`
  const parts = [
    audience.customerType === 'credit' ? 'Credit customers' : audience.customerType === 'prepaid' ? 'Prepaid customers' : 'Customers',
    audience.pinCodes?.length ? `in ${audience.pinCodes.join(', ')}` : '',
    audience.hasActiveSubscription === true ? 'with a subscription' : audience.hasActiveSubscription === false ? 'without a subscription' : '',
  ]
  return parts.filter(Boolean).join(' ')
}

/**
 * The audience once it is complete and valid, otherwise null (nothing to count yet): a group needs at least one narrowing choice with
 * valid PIN codes, and chosen customers need at least one customer.
 */
export function readyAudience(values: Pick<BroadcastFormValues, 'audienceType' | 'customerType' | 'pinCodes' | 'subscription' | 'customerIds'>): Audience | null {
  if (values.audienceType === 'customers') return values.customerIds.length > 0 && values.customerIds.length <= MAX_CHOSEN_CUSTOMERS ? toAudience(values) : null
  if (values.audienceType === 'all') return toAudience(values)
  const pins = parsePinCodes(values.pinCodes)
  if (pins.length > MAX_PIN_CODES || pins.some(pin => !/^[1-9][0-9]{5}$/.test(pin))) return null
  return !values.customerType && pins.length === 0 && values.subscription === 'any' ? null : toAudience(values)
}
