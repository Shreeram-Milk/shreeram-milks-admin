import { formatTime12h } from '@/lib/business-time'
import type { CutoffRule, DayRelation, DeliverySlot, FulfilmentProfile, ServiceArea } from '../configuration/types'
import type { Customer } from '../customers/types'
import { getPrimaryAddress } from '../customers/address'
import type { Product, PurchaseMethod } from '../products/types'

export type CutoffContext = {
  slotId: string
  slotName: string
  ruleName: string
  dayRelation: DayRelation
  cutoffTime: string
  /** e.g. "Previous day at 3:00 PM" */
  description: string
}

export type EligibilityResult = {
  serviceable: boolean
  /** Human-readable blocking reason; null when serviceable. */
  reason: string | null
  /** False for shipping profiles, which have no delivery slots. */
  slotRequired: boolean
  /** Active slots the customer's PIN allows. */
  allowedSlotIds: string[]
  /** Slots the PIN references that are inactive: shown for existing subscriptions, never selectable. */
  inactiveSlotIds: string[]
  cutoffContext: CutoffContext[]
}

export type EligibilityInput = {
  customer: Pick<Customer, 'addresses'>
  product: Pick<Product, 'status' | 'purchaseMethods'>
  fulfilmentProfile: FulfilmentProfile | undefined
  serviceArea: ServiceArea | undefined
  cutoffRule?: CutoffRule | undefined
  deliverySlots: DeliverySlot[]
  /** Which way the customer is buying; defaults to a subscription. */
  purchaseMethod?: PurchaseMethod
}

const METHOD_PHRASE: Record<PurchaseMethod, string> = { subscription: 'subscriptions', buy_once: 'Buy Once orders', trial: 'trials' }
const blocked = (reason: string): EligibilityResult => ({ serviceable: false, reason, slotRequired: false, allowedSlotIds: [], inactiveSlotIds: [], cutoffContext: [] })
const RELATION_LABEL: Record<DayRelation, string> = { previous_day: 'Previous day', same_day: 'Same day' }

export function describeCutoff(dayRelation: DayRelation, cutoffTime: string): string {
  return `${RELATION_LABEL[dayRelation]} at ${formatTime12h(cutoffTime)}`
}

/**
 * Single authority on whether a customer can receive a product subscription and which slots apply.
 * Chain: product -> fulfilment profile -> service area -> customer PIN -> allowed slots.
 */
export function resolveSubscriptionEligibility({ customer, product, fulfilmentProfile, serviceArea, cutoffRule, deliverySlots, purchaseMethod = 'subscription' }: EligibilityInput): EligibilityResult {
  if (product.status !== 'active') return blocked('This product is not active.')
  if (!product.purchaseMethods.includes(purchaseMethod)) return blocked(`This product does not support ${METHOD_PHRASE[purchaseMethod]}.`)
  if (!fulfilmentProfile) return blocked('This product has no fulfilment profile.')
  if (fulfilmentProfile.status !== 'active') return blocked(`The fulfilment profile “${fulfilmentProfile.name}” is inactive.`)
  if (!serviceArea || serviceArea.status !== 'active') return blocked('The service area for this product is unavailable.')

  const address = getPrimaryAddress(customer)
  if (!address) return blocked('The customer has no delivery address.')

  if (fulfilmentProfile.deliveryMethod === 'shipping') {
    if (serviceArea.coverageType === 'state' && serviceArea.state.trim().toLowerCase() !== address.state.trim().toLowerCase()) {
      return blocked(`Shipping is not available to ${address.state} under the selected product's fulfilment profile.`)
    }
    return { serviceable: true, reason: null, slotRequired: false, allowedSlotIds: [], inactiveSlotIds: [], cutoffContext: [] }
  }

  const notAvailable = `Delivery is not available for PIN ${address.pinCode} under the selected product's fulfilment profile.`
  const pin = serviceArea.pinCodes.find(entry => entry.pinCode === address.pinCode && entry.status === 'active')
  if (serviceArea.coverageType !== 'pin_code' || !pin) return blocked(notAvailable)

  const slotsById = new Map(deliverySlots.map(slot => [slot.id, slot]))
  const pinSlots = pin.allowedDeliverySlotIds.flatMap(id => { const slot = slotsById.get(id); return slot ? [slot] : [] })
  const allowedSlotIds = pinSlots.filter(slot => slot.status === 'active').map(slot => slot.id)
  const inactiveSlotIds = pinSlots.filter(slot => slot.status !== 'active').map(slot => slot.id)
  if (!allowedSlotIds.length) return blocked(`No active delivery slot is available for PIN ${address.pinCode}.`)

  const cutoffContext = allowedSlotIds.flatMap((slotId): CutoffContext[] => {
    const condition = cutoffRule?.conditions.find(item => item.deliverySlotId === slotId)
    const slot = slotsById.get(slotId)
    if (!condition || !slot || !cutoffRule) return []
    return [{ slotId, slotName: slot.name, ruleName: cutoffRule.name, dayRelation: condition.dayRelation, cutoffTime: condition.cutoffTime, description: describeCutoff(condition.dayRelation, condition.cutoffTime) }]
  })
  return { serviceable: true, reason: null, slotRequired: true, allowedSlotIds, inactiveSlotIds, cutoffContext }
}
