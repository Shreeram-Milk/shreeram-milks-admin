/**
 * MOCK BUSINESS POLICY — not yet confirmed by the business.
 * 'variant_price': each trial delivery is priced at the variant's normal price, so a credit customer's
 *                  delivered trial days are charged like any delivery.
 * 'free': trial deliveries carry a ₹0 snapshot and create no charge.
 * One constant; the rest of the app only reads the resulting price snapshot.
 */
export type TrialPricingPolicy = 'variant_price' | 'free'
export const TRIAL_PRICING_POLICY: TrialPricingPolicy = 'variant_price'

export function trialUnitPrice(variantPricePaise: number | undefined): number | null {
  if (TRIAL_PRICING_POLICY === 'free') return 0
  return typeof variantPricePaise === 'number' ? variantPricePaise : null
}
