import type { PrepaidAdjustmentType } from './types'

/**
 * MOCK BUSINESS POLICY — the business has not confirmed these rules yet.
 * They are isolated here so nothing else hard-codes them: UI components and services read this one object,
 * and changing a value changes behaviour everywhere without touching any other file.
 *
 *  skipHandling:   what a prepaid customer gets when one of their paid deliveries is skipped
 *  cancelHandling: what they get for each paid future delivery cancelled with their subscription
 */
export type PrepaidAdjustmentPolicy = {
  skipHandling: Extract<PrepaidAdjustmentType, 'carry_forward' | 'account_credit'>
  cancelHandling: Extract<PrepaidAdjustmentType, 'carry_forward' | 'account_credit'>
}

export const PREPAID_ADJUSTMENT_POLICY: PrepaidAdjustmentPolicy = {
  skipHandling: 'carry_forward',
  cancelHandling: 'account_credit',
}

const OUTCOME_COPY: Record<PrepaidAdjustmentPolicy['skipHandling'], string> = {
  carry_forward: 'the paid delivery is carried forward as an entitlement',
  account_credit: 'the delivery’s value is added as prepaid account credit',
}

/** One sentence for dialogs: what the current policy does for a prepaid customer in this situation. */
export function describePolicyOutcome(trigger: 'skip' | 'cancel', policy: PrepaidAdjustmentPolicy = PREPAID_ADJUSTMENT_POLICY): string {
  return OUTCOME_COPY[trigger === 'skip' ? policy.skipHandling : policy.cancelHandling]
}
