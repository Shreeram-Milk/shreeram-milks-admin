import { addDays, isIsoDate, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { deliverySlotService, trialPlanService } from '../configuration/mock-store'
import type { DeliverySlot, TrialPlan } from '../configuration/types'
import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { deliveryService } from '../deliveries/service'
import { productService } from '../products/service'
import type { Product, ProductVariant } from '../products/types'
import { subscriptionService, type SubscriptionContext } from '../subscriptions/service'
import type { Subscription, SubscriptionInput } from '../subscriptions/types'
import { deriveTrialStatus, trialEndDate } from './generation'
import { trialRepository } from './mock-repository'
import { trialUnitPrice } from './policy'
import type { TrialEnrollment, TrialInput, TrialStatus } from './types'

export class TrialRuleError extends Error {}

export type TrialView = {
  trial: TrialEnrollment
  status: TrialStatus
  customer: Customer | undefined
  product: Product | undefined
  variant: ProductVariant | undefined
  slot: DeliverySlot | undefined
}

export type TrialListQuery = { search: string; status: TrialStatus | ''; productId: string; date: IsoDate | ''; page: number; pageSize: number }
export type TrialSummary = { active: number; endingSoon: number; completedAwaitingConversion: number }

/** Why a trial cannot be converted right now; null when it can. */
export type ConversionBlock = string | null

export type TrialContext = { fulfilment: SubscriptionContext; plans: TrialPlan[] }

/** A trial that is still running ends "soon" when its last delivery is within this many days. */
export const ENDING_SOON_DAYS = 2

function requireTrial(id: string): TrialEnrollment {
  const trial = trialRepository.get(id)
  if (!trial) throw new TrialRuleError('Trial not found.')
  return trial
}

function toView(trial: TrialEnrollment, today: IsoDate, slots: Map<string, DeliverySlot>): TrialView {
  const product = productService.getById(trial.productId)
  return {
    trial, status: deriveTrialStatus(trial, today), customer: customerService.getById(trial.customerId), product,
    variant: product?.variants.find(variant => variant.id === trial.variantId),
    slot: trial.deliverySlotId ? slots.get(trial.deliverySlotId) : undefined,
  }
}

/** Plans that can be offered for a product: only those linked to it and still active (an existing trial keeps its own plan). */
function plansFor(product: Product | undefined, keepPlanId?: string): TrialPlan[] {
  if (!product) return []
  return product.trialPlanIds.flatMap(id => { const plan = trialPlanService.getById(id); return plan && (plan.status === 'active' || plan.id === keepPlanId) ? [plan] : [] })
}

export const trialService = {
  list({ search, status, productId, date, page, pageSize }: TrialListQuery): { rows: TrialView[]; total: number } {
    const today = todayInBusinessZone()
    const slots = new Map(deliverySlotService.list().map(slot => [slot.id, slot]))
    const term = search.trim().toLowerCase()
    const matches = trialRepository.list()
      .filter(trial => (!productId || trial.productId === productId) && (!date || (trial.startDate <= date && date <= trial.endDate)))
      .map(trial => toView(trial, today, slots))
      .filter(view => (!status || view.status === status) && (!term || [view.customer?.fullName, view.customer?.mobile, view.product?.name, view.variant?.name].join(' ').toLowerCase().includes(term)))
      .sort((a, b) => b.trial.startDate.localeCompare(a.trial.startDate) || (a.customer?.fullName ?? '').localeCompare(b.customer?.fullName ?? ''))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  getView(id: string): TrialView | undefined {
    const trial = trialRepository.get(id)
    return trial ? toView(trial, todayInBusinessZone(), new Map(deliverySlotService.list().map(slot => [slot.id, slot]))) : undefined
  },
  getById: (id: string) => trialRepository.get(id),
  listForCustomer(customerId: string): TrialView[] {
    const today = todayInBusinessZone()
    const slots = new Map(deliverySlotService.list().map(slot => [slot.id, slot]))
    return trialRepository.listForCustomer(customerId).sort((a, b) => b.startDate.localeCompare(a.startDate)).map(trial => toView(trial, today, slots))
  },
  listTrialProducts: (): Product[] => productService.list().filter(product => product.status === 'active' && product.purchaseMethods.includes('trial')),
  /** Fulfilment (PIN, slots, cut-off) for a customer taking this product on trial, plus the plans linked to the product. */
  resolveContext({ customerId, productId }: { customerId: string; productId: string }): TrialContext {
    const fulfilment = subscriptionService.resolveContext({ customerId, productId, purchaseMethod: 'trial' })
    return { fulfilment, plans: plansFor(fulfilment.product) }
  },

  create(input: TrialInput): TrialEnrollment {
    const today = todayInBusinessZone()
    const { fulfilment, plans } = trialService.resolveContext({ customerId: input.customerId, productId: input.productId })
    const { customer, product, eligibility } = fulfilment
    if (!customer) throw new TrialRuleError('Select a customer.')
    if (customer.status !== 'active') throw new TrialRuleError('Trials can only be created for active customers.')
    if (!product || !eligibility) throw new TrialRuleError('Select a product.')
    if (!eligibility.serviceable) throw new TrialRuleError(eligibility.reason ?? 'This trial cannot be delivered.')
    const variant = product.variants.find(item => item.id === input.variantId)
    if (!variant || variant.status !== 'active') throw new TrialRuleError('Select an active variant.')
    const plan = plans.find(item => item.id === input.trialPlanId)
    if (!plan) throw new TrialRuleError('Choose one of the trial plans offered for this product.')
    let deliverySlotId: string | null = null
    if (eligibility.slotRequired) {
      if (!input.deliverySlotId || !eligibility.allowedSlotIds.includes(input.deliverySlotId)) throw new TrialRuleError('Select a delivery slot available for the customer’s PIN code.')
      deliverySlotId = input.deliverySlotId
    }
    if (!isIsoDate(input.startDate)) throw new TrialRuleError('Choose a start date.')
    if (input.startDate < today) throw new TrialRuleError('The start date cannot be in the past.')
    // One trial of a product per customer: a repeat is only possible after the earlier one was cancelled.
    if (trialRepository.listForCustomer(customer.id).some(existing => existing.productId === product.id && existing.lifecycle !== 'cancelled')) throw new TrialRuleError(`${customer.fullName} has already taken a ${product.name} trial.`)

    const created = trialRepository.insert({
      customerId: customer.id, productId: product.id, variantId: variant.id, trialPlanId: plan.id, trialPlanNameSnapshot: plan.name, durationDaysSnapshot: plan.duration,
      fulfilmentProfileId: product.fulfilmentProfileId, deliverySlotId, quantity: 1, unitPricePaiseSnapshot: trialUnitPrice(variant.pricePaise),
      startDate: input.startDate, endDate: trialEndDate(input.startDate, plan.duration), lifecycle: 'open', cancellation: null, convertedSubscriptionId: null,
    })
    deliveryService.reconcileTrialChanges(created.id)
    return created
  },

  /** Future trial deliveries after the effective date are cancelled (kept as history); earlier ones stay. */
  cancel(id: string, { effectiveDate, reason }: { effectiveDate: IsoDate; reason: string }): TrialEnrollment {
    const trial = requireTrial(id)
    const today = todayInBusinessZone()
    const status = deriveTrialStatus(trial, today)
    if (status === 'cancelled' || status === 'converted') throw new TrialRuleError(`A ${status} trial cannot be cancelled.`)
    if (status === 'completed') throw new TrialRuleError('This trial has already finished.')
    if (!isIsoDate(effectiveDate) || effectiveDate < today) throw new TrialRuleError('The effective date cannot be in the past.')
    if (effectiveDate >= trial.endDate) throw new TrialRuleError('The trial ends on or before that date, so there is nothing left to cancel.')
    const updated = trialRepository.replace(id, { lifecycle: 'cancelled', cancellation: { effectiveDate, reason: reason.trim() } })
    if (!updated) throw new TrialRuleError('Trial not found.')
    deliveryService.reconcileTrialChanges(id)
    return updated
  },

  /** Null when the trial can be converted; otherwise the reason it cannot. */
  conversionBlock(trial: TrialEnrollment, today: IsoDate = todayInBusinessZone()): ConversionBlock {
    const status = deriveTrialStatus(trial, today)
    if (status === 'converted') return 'This trial has already been converted.'
    if (status === 'cancelled') return 'A cancelled trial cannot be converted.'
    if (status === 'upcoming') return 'The trial has not started yet.'
    const product = productService.getById(trial.productId)
    if (!product || product.status !== 'active' || !product.purchaseMethods.includes('subscription')) return 'This product no longer offers subscriptions.'
    return null
  },

  /**
   * Creates a real subscription (with its own schedule) and only then marks the trial converted.
   * The trial's plan is never copied as a schedule, and the trial's history is kept.
   */
  convertToSubscription(trialId: string, input: SubscriptionInput): Subscription {
    const trial = requireTrial(trialId)
    const block = trialService.conversionBlock(trial)
    if (block) throw new TrialRuleError(block)
    if (input.customerId !== trial.customerId) throw new TrialRuleError('The subscription must be for the same customer as the trial.')
    const subscription = subscriptionService.create(input)
    trialRepository.replace(trialId, { lifecycle: 'converted', convertedSubscriptionId: subscription.id })
    return subscription
  },

  /** Aggregate counts for the dashboard. */
  getSummary(today: IsoDate = todayInBusinessZone()): TrialSummary {
    const limit = addDays(today, ENDING_SOON_DAYS)
    let active = 0
    let endingSoon = 0
    let completedAwaitingConversion = 0
    for (const trial of trialRepository.list()) {
      const status = deriveTrialStatus(trial, today)
      if (status === 'active') { active += 1; if (trial.endDate <= limit) endingSoon += 1 }
      if (status === 'completed') completedAwaitingConversion += 1
    }
    return { active, endingSoon, completedAwaitingConversion }
  },
}
