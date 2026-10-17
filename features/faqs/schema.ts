import { z } from 'zod'
import { SUPPORT_CATEGORY_IDS } from '../support-tickets/categories'
import { MAX_KEYWORDS } from './types'

export const faqSchema = z.object({
  topic: z.enum(SUPPORT_CATEGORY_IDS),
  questionEn: z.string().trim().min(1, 'Enter the question.').max(160, 'Keep the question under 160 characters.'),
  questionGu: z.string().trim().max(160, 'Keep the question under 160 characters.'),
  answerEn: z.string().trim().min(1, 'Enter the answer.').max(800, 'Keep the answer under 800 characters.'),
  answerGu: z.string().trim().max(800, 'Keep the answer under 800 characters.'),
  /** Typed as one comma-separated line; the service turns it into a clean list. */
  searchKeywords: z.string().max(200, 'Keep the keywords under 200 characters.').refine(text => text.split(',').map(word => word.trim()).filter(Boolean).length <= MAX_KEYWORDS, `Add at most ${MAX_KEYWORDS} keywords.`),
  featured: z.boolean(),
  sortOrder: z.number().int('Use a whole number.').min(0, 'Use zero or greater.'),
  status: z.enum(['draft', 'published', 'inactive']),
})
export type FaqFormValues = z.infer<typeof faqSchema>
