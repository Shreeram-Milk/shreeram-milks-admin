import { z } from 'zod'
import { isIsoDate, type IsoDate } from '@/lib/business-time'

/** Field-level rules only; serviceability, plan eligibility and duplicate checks live in the trial service. */
export function buildTrialSchema({ today }: { today: IsoDate }) {
  return z.object({
    customerId: z.string().min(1, 'Select a customer.'),
    productId: z.string().min(1, 'Select a product.'),
    variantId: z.string().min(1, 'Select a variant.'),
    trialPlanId: z.string().min(1, 'Select a trial plan.'),
    deliverySlotId: z.string(),
    startDate: z.string().min(1, 'Choose a start date.'),
  }).superRefine((value, context) => {
    if (value.startDate && !isIsoDate(value.startDate)) context.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a valid start date.' })
    else if (value.startDate && value.startDate < today) context.addIssue({ code: 'custom', path: ['startDate'], message: 'The start date cannot be in the past.' })
  })
}
export type TrialFormValues = z.infer<ReturnType<typeof buildTrialSchema>>
