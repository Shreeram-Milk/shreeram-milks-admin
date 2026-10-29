import { z } from 'zod'
import { MAX_BODY_LENGTH } from './types'
import { t } from './messages'

// Messages are looked up when shown, so they follow the admin's language.
export const policySchema = z.object({
  type: z.enum(['privacy', 'terms', 'refund', 'cancellation', 'subscription', 'delivery']),
  titleEn: z.string().trim().min(1, { error: () => t('errTitle') }).max(120, { error: () => t('errTitleLong') }),
  titleGu: z.string().trim().max(120, { error: () => t('errTitleLong') }),
  bodyEn: z.string().trim().min(1, { error: () => t('errText') }).max(MAX_BODY_LENGTH, { error: () => t('errTextLong', { max: MAX_BODY_LENGTH }) }),
  bodyGu: z.string().trim().max(MAX_BODY_LENGTH, { error: () => t('errTextLong', { max: MAX_BODY_LENGTH }) }),
  version: z.string().trim().min(1, { error: () => t('errVersion') }).max(20, { error: () => t('errVersionLong') }),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => t('errDate') }),
})
export type PolicyFormValues = z.infer<typeof policySchema>
