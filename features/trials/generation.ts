import { addDays, type IsoDate } from '@/lib/business-time'
import { trialDeliveryId } from '../deliveries/types'
import type { OneOffDeliveryDraft } from '../deliveries/oneoff'
import type { TrialEnrollment, TrialStatus } from './types'

export const MAX_TRIAL_DAYS = 31

/** Pure: last day of a trial of `durationDays` days starting on `startDate` (a 3-day trial from 10 Oct ends 12 Oct). */
export const trialEndDate = (startDate: IsoDate, durationDays: number): IsoDate => addDays(startDate, Math.max(durationDays, 1) - 1)

/** Pure: one delivery date per trial day, stopping after a cancellation's effective date (that day still delivers). */
export function trialDeliveryDates(trial: Pick<TrialEnrollment, 'startDate' | 'durationDaysSnapshot' | 'cancellation'>): IsoDate[] {
  const days = Math.min(trial.durationDaysSnapshot, MAX_TRIAL_DAYS)
  const dates = Array.from({ length: days }, (_, index) => addDays(trial.startDate, index))
  const cutoff = trial.cancellation?.effectiveDate
  return cutoff ? dates.filter(date => date <= cutoff) : dates
}

/** Pure: the deliveries a trial wants. Quantity and price come from the enrollment's own snapshot. */
export function buildTrialDeliveryDrafts(trial: TrialEnrollment): OneOffDeliveryDraft[] {
  return trialDeliveryDates(trial).map(date => ({
    id: trialDeliveryId(trial.id, date), deliveryDate: date, customerId: trial.customerId, sourceType: 'trial' as const,
    orderId: null, orderItemId: null, trialEnrollmentId: trial.id,
    productId: trial.productId, variantId: trial.variantId, quantity: trial.quantity,
    unitPricePaise: trial.unitPricePaiseSnapshot, deliverySlotId: trial.deliverySlotId,
  }))
}

/**
 * Pure: the trial's status as of `today`. Cancelled and converted are decisions that always win;
 * otherwise the dates decide (upcoming, active, completed once the last day has passed).
 */
export function deriveTrialStatus(trial: Pick<TrialEnrollment, 'lifecycle' | 'startDate' | 'endDate'>, today: IsoDate): TrialStatus {
  if (trial.lifecycle === 'cancelled') return 'cancelled'
  if (trial.lifecycle === 'converted') return 'converted'
  if (today < trial.startDate) return 'upcoming'
  return today > trial.endDate ? 'completed' : 'active'
}
