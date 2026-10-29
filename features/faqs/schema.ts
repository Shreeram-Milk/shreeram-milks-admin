import { z } from 'zod'
import { SUPPORT_CATEGORY_IDS } from '../support-tickets/categories'
import { MAX_KEYWORDS } from './types'
import { t } from './messages'

// Messages are looked up when shown, so they follow the admin's language.
export const faqSchema = z.object({
  topic: z.enum(SUPPORT_CATEGORY_IDS),
  questionEn: z.string().trim().min(1, { error: () => t('errQuestion') }).max(160, { error: () => t('errQuestionLong') }),
  questionGu: z.string().trim().max(160, { error: () => t('errQuestionLong') }),
  answerEn: z.string().trim().min(1, { error: () => t('errAnswer') }).max(800, { error: () => t('errAnswerLong') }),
  answerGu: z.string().trim().max(800, { error: () => t('errAnswerLong') }),
  /** Typed as one comma-separated line; the service turns it into a clean list. */
  searchKeywords: z.string().max(200, { error: () => t('errKeywordsLong') }).refine(text => text.split(',').map(word => word.trim()).filter(Boolean).length <= MAX_KEYWORDS, { error: () => t('errKeywordsMany', { max: MAX_KEYWORDS }) }),
  featured: z.boolean(),
  sortOrder: z.number().int({ error: () => t('errWhole') }).min(0, { error: () => t('errNonNegative') }),
  status: z.enum(['draft', 'published', 'inactive']),
})
export type FaqFormValues = z.infer<typeof faqSchema>
