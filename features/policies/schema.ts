import { z } from 'zod'
import { MAX_BODY_LENGTH } from './types'

export const policySchema = z.object({
  type: z.enum(['privacy', 'terms', 'refund', 'cancellation', 'subscription', 'delivery']),
  titleEn: z.string().trim().min(1, 'Enter the title.').max(120, 'Keep the title under 120 characters.'),
  titleGu: z.string().trim().max(120, 'Keep the title under 120 characters.'),
  bodyEn: z.string().trim().min(1, 'Enter the policy text.').max(MAX_BODY_LENGTH, `Keep the text under ${MAX_BODY_LENGTH} characters.`),
  bodyGu: z.string().trim().max(MAX_BODY_LENGTH, `Keep the text under ${MAX_BODY_LENGTH} characters.`),
  version: z.string().trim().min(1, 'Enter a version.').max(20, 'Keep the version under 20 characters.'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date this takes effect.'),
})
export type PolicyFormValues = z.infer<typeof policySchema>
