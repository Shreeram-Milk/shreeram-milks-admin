import { z } from 'zod'
import { isIsoDate, type IsoDate } from '@/lib/business-time'

const scheduleTypes = ['daily', 'alternate_days', 'custom_weekdays'] as const

/** Field-level rules only. Serviceability and slot eligibility come from the eligibility helper, not from this schema. */
export function buildSubscriptionSchema({ today, originalStartDate }: { today: IsoDate; originalStartDate?: IsoDate }) {
  return z.object({
    customerId: z.string().min(1, 'Select a customer.'),
    productId: z.string().min(1, 'Select a product.'),
    variantId: z.string().min(1, 'Select a variant.'),
    scheduleType: z.union([z.literal(''), z.enum(scheduleTypes)]),
    weekdays: z.array(z.number().int().min(0).max(6)),
    alternatePatternDate: z.string(),
    deliverySlotId: z.string(),
    startDate: z.string().min(1, 'Choose a start date.'),
  }).superRefine((value, context) => {
    if (value.scheduleType === '') context.addIssue({ code: 'custom', path: ['scheduleType'], message: 'Select a schedule type.' })
    if (value.scheduleType === 'custom_weekdays' && value.weekdays.length === 0) context.addIssue({ code: 'custom', path: ['weekdays'], message: 'Select at least one delivery day.' })
    if (value.scheduleType === 'alternate_days' && !isIsoDate(value.alternatePatternDate)) context.addIssue({ code: 'custom', path: ['alternatePatternDate'], message: 'Choose the start pattern date.' })
    if (value.startDate && !isIsoDate(value.startDate)) context.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a valid start date.' })
    else if (value.startDate && value.startDate !== originalStartDate && value.startDate < today) context.addIssue({ code: 'custom', path: ['startDate'], message: 'The start date cannot be in the past.' })
  })
}
export type SubscriptionFormValues = z.infer<ReturnType<typeof buildSubscriptionSchema>>
