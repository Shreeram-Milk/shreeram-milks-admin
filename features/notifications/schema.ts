import { z } from 'zod'
import type { Audience } from './api'
import { t } from './messages'

export const TITLE_MAX = 60
export const BODY_MAX = 240
export const MAX_PIN_CODES = 50
export const MAX_CHOSEN_CUSTOMERS = 200

// Messages are looked up when shown, so they follow the admin's language.
const title = z.string().trim().min(1, { error: () => t('errTitle') }).max(TITLE_MAX, { error: () => t('errTitleLong', { max: TITLE_MAX }) })
const body = z.string().trim().min(1, { error: () => t('errBody') }).max(BODY_MAX, { error: () => t('errBodyLong', { max: BODY_MAX }) })
const titleGujarati = z.string().trim().max(TITLE_MAX, { error: () => t('errTitleLong', { max: TITLE_MAX }) })
const bodyGujarati = z.string().trim().max(BODY_MAX, { error: () => t('errBodyLong', { max: BODY_MAX }) })

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
  pinCodes: z.string().max(600, { error: () => t('errPinsLong') }),
  subscription: z.enum(['any', 'with', 'without']),
  customerIds: z.array(z.string()).max(MAX_CHOSEN_CUSTOMERS, { error: () => t('errCustomersMax', { max: MAX_CHOSEN_CUSTOMERS }) }),
}).superRefine((value, context) => {
  if (value.audienceType === 'filter') {
    const pins = parsePinCodes(value.pinCodes)
    if (pins.some(pin => !/^[1-9][0-9]{5}$/.test(pin))) context.addIssue({ code: 'custom', path: ['pinCodes'], message: t('errPins') })
    else if (pins.length > MAX_PIN_CODES) context.addIssue({ code: 'custom', path: ['pinCodes'], message: t('errPinsMax', { max: MAX_PIN_CODES }) })
    else if (!value.customerType && pins.length === 0 && value.subscription === 'any') context.addIssue({ code: 'custom', path: ['customerType'], message: t('errNarrow') })
  }
  if (value.audienceType === 'customers' && value.customerIds.length === 0) context.addIssue({ code: 'custom', path: ['customerIds'], message: t('errChooseCustomer') })
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
  if (audience.type === 'all') return t('describeAll')
  if (audience.type === 'customers') return t(audience.customerIds.length === 1 ? 'describeChosenOne' : 'describeChosenMany', { count: audience.customerIds.length })
  const parts = [
    audience.customerType === 'credit' ? t('creditCustomers') : audience.customerType === 'prepaid' ? t('prepaidCustomers') : t('describeCustomers'),
    audience.pinCodes?.length ? t('describeIn', { pins: audience.pinCodes.join(', ') }) : '',
    audience.hasActiveSubscription === true ? t('describeWith') : audience.hasActiveSubscription === false ? t('describeWithout') : '',
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
