import type { IsoDate } from '@/lib/business-time'
import { liveLabels } from '@/lib/i18n/core'
import { t, type PolicyKey } from './messages'

export type PolicyType = 'privacy' | 'terms' | 'refund' | 'cancellation' | 'subscription' | 'delivery'
export type PolicyStatus = 'draft' | 'published' | 'archived'

export const POLICY_TYPE_KEYS = {
  privacy: 'typePrivacy', terms: 'typeTerms', refund: 'typeRefund', cancellation: 'typeCancellation', subscription: 'typeSubscription', delivery: 'typeDelivery',
} as const satisfies Record<PolicyType, PolicyKey>
export const POLICY_TYPE_LABELS = liveLabels(t, POLICY_TYPE_KEYS)
export const POLICY_STATUS_LABELS = liveLabels(t, { draft: 'statusDraft', published: 'statusPublished', archived: 'statusArchived' } satisfies Record<PolicyStatus, PolicyKey>)

/** One version of one legal document. Published versions are never edited; a change is a new version. */
export type PolicyDocument = {
  id: string
  type: PolicyType
  titleEn: string
  titleGu: string
  bodyEn: string
  bodyGu: string
  /** Staff-chosen label such as "1.0" or "2.1"; unique within a policy type. */
  version: string
  status: PolicyStatus
  effectiveDate: IsoDate
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PolicyInput = Omit<PolicyDocument, 'id' | 'status' | 'publishedAt' | 'createdAt' | 'updatedAt'> & { id?: string }

/** Publishing needs real text, not a stub. */
export const MIN_PUBLISHED_BODY_LENGTH = 50
export const MAX_BODY_LENGTH = 20000
