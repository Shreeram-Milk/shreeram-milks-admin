import type { IsoDate } from '@/lib/business-time'
import type { Paise } from '@/lib/money'

/** upcoming/active/completed are derived from dates; cancelled and converted are stored decisions. */
export type TrialStatus = 'upcoming' | 'active' | 'completed' | 'cancelled' | 'converted'
export type TrialLifecycle = 'open' | 'cancelled' | 'converted'

export type TrialEnrollment = {
  id: string
  customerId: string
  productId: string
  variantId: string
  trialPlanId: string
  /** Frozen at enrollment so later plan edits can't change a trial that already started. */
  trialPlanNameSnapshot: string
  durationDaysSnapshot: number
  fulfilmentProfileId: string
  deliverySlotId: string | null
  /** Units per daily delivery. */
  quantity: number
  /** Price per unit used for the trial's deliveries (see trial pricing policy). Null when the catalog price is missing. */
  unitPricePaiseSnapshot: Paise | null
  startDate: IsoDate
  endDate: IsoDate
  lifecycle: TrialLifecycle
  cancellation: { effectiveDate: IsoDate; reason: string } | null
  convertedSubscriptionId: string | null
  createdAt: string
  updatedAt: string
}

export type TrialInput = {
  customerId: string
  productId: string
  variantId: string
  trialPlanId: string
  deliverySlotId: string | null
  startDate: IsoDate
}

export const TRIAL_STATUS_LABELS: Record<TrialStatus, string> = { upcoming: 'Upcoming', active: 'Active', completed: 'Completed', cancelled: 'Cancelled', converted: 'Converted' }
