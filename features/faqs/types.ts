import { liveLabels } from '@/lib/i18n/core'
import { t } from './messages'
import type { SupportCategory } from '../support-tickets/categories'

export type FaqStatus = 'draft' | 'published' | 'inactive'

export const FAQ_STATUS_LABELS = liveLabels(t, { draft: 'statusDraft', published: 'statusPublished', inactive: 'statusInactive' })
/** Most featured questions the app's Help screen can highlight. */
export const MAX_FEATURED_FAQS = 5
export const MAX_KEYWORDS = 10

/** A Help Center article: a question and answer in English and Gujarati, filed under a support category. */
export type Faq = {
  id: string
  /** One of the issue types the app's Help screen offers; shared with support tickets. */
  topic: SupportCategory
  questionEn: string
  questionGu: string
  answerEn: string
  answerGu: string
  /** Extra words people might search for, so "milk late" finds the delivery article. */
  searchKeywords: string[]
  featured: boolean
  /** Lower numbers appear first within the topic. */
  sortOrder: number
  status: FaqStatus
  updatedAt: string
}

export type FaqInput = Omit<Faq, 'id' | 'updatedAt'> & { id?: string }
