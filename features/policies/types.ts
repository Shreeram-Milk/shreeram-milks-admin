import type { IsoDate } from '@/lib/business-time'

export type PolicyType = 'privacy' | 'terms' | 'refund' | 'cancellation' | 'subscription' | 'delivery'
export type PolicyStatus = 'draft' | 'published' | 'archived'

export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  privacy: 'Privacy Policy', terms: 'Terms & Conditions', refund: 'Refund Policy', cancellation: 'Cancellation Policy', subscription: 'Subscription Policy', delivery: 'Delivery Policy',
}
export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' }

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
