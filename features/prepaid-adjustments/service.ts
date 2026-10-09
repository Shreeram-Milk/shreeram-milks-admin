import { addDays, isIsoDate, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { isValidPaise, type Paise } from '@/lib/money'
import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { deliveryRepository } from '../deliveries/mock-repository'
import type { DeliveryInstance } from '../deliveries/types'
import { productService } from '../products/service'
import { planAdjustment } from './planning'
import { PREPAID_ADJUSTMENT_POLICY } from './policy'
import { prepaidAdjustmentRepository } from './mock-repository'
import type { AdjustmentTrigger, PrepaidAdjustment, PrepaidAdjustmentStatus, PrepaidAdjustmentType } from './types'

export class PrepaidAdjustmentRuleError extends Error {}

/** Catch-up only looks at recent history so reconciliation stays bounded. */
const RECONCILE_LOOKBACK_DAYS = 62

export type PrepaidAdjustmentView = { adjustment: PrepaidAdjustment; customer: Customer | undefined }
export type PrepaidAdjustmentQuery = { search: string; status: PrepaidAdjustmentStatus | ''; type: PrepaidAdjustmentType | ''; customerId: string; page: number; pageSize: number }
export type PrepaidAccountSummary = { pendingCreditPaise: Paise; appliedCreditPaise: Paise; pendingEntitlementUnits: number; pendingRefundPaise: Paise; pendingCount: number }
export type PrepaidIssue = { deliveryId: string; deliveryDate: IsoDate; customerId: string; message: string }
export type PrepaidOverview = { pendingCount: number; pendingValuePaise: Paise; refundPendingCount: number }

const isMoney = (adjustment: PrepaidAdjustment) => adjustment.type === 'account_credit' || adjustment.type === 'manual_adjustment'

function postForDelivery(delivery: DeliveryInstance, trigger: AdjustmentTrigger, customer: Customer | undefined): { created: boolean; issue: string | null } {
  const plan = planAdjustment({ trigger, delivery, customerType: customer?.customerType, policy: PREPAID_ADJUSTMENT_POLICY })
  if (plan.kind === 'none') return { created: false, issue: null }
  if (plan.kind === 'issue') return { created: false, issue: plan.message }
  const product = productService.getById(delivery.productId)
  const variant = product?.variants.find(item => item.id === delivery.variantId)
  const [added] = prepaidAdjustmentRepository.append([{
    id: `prepaid-adj-${plan.dedupeKey}`, customerId: delivery.customerId, subscriptionId: delivery.subscriptionId, deliveryId: delivery.id, type: plan.type, status: 'pending',
    amountPaise: plan.amountPaise,
    entitlement: plan.type === 'carry_forward' ? { productId: delivery.productId, variantId: delivery.variantId, productName: product?.name ?? 'Product', variantName: variant?.name ?? '', quantity: plan.quantity } : null,
    reason: plan.reason, effectiveDate: delivery.deliveryDate, dedupeKey: plan.dedupeKey,
  }])
  return { created: Boolean(added), issue: null }
}

function requirePending(id: string): PrepaidAdjustment {
  const adjustment = prepaidAdjustmentRepository.get(id)
  if (!adjustment) throw new PrepaidAdjustmentRuleError('Adjustment not found.')
  if (adjustment.status !== 'pending') throw new PrepaidAdjustmentRuleError(`Only pending adjustments can be changed; this one is ${adjustment.status}.`)
  return adjustment
}

export const prepaidAdjustmentService = {
  list({ search, status, type, customerId, page, pageSize }: PrepaidAdjustmentQuery): { rows: PrepaidAdjustmentView[]; total: number } {
    const customers = new Map(customerService.listAll().map(customer => [customer.id, customer]))
    const term = search.trim().toLowerCase()
    const matches = prepaidAdjustmentRepository.list()
      .filter(item => (!status || item.status === status) && (!type || item.type === type) && (!customerId || item.customerId === customerId))
      .map(adjustment => ({ adjustment, customer: customers.get(adjustment.customerId) }))
      .filter(view => !term || [view.customer?.fullName, view.customer?.mobile, view.adjustment.reason, view.adjustment.entitlement?.productName].join(' ').toLowerCase().includes(term))
      .sort((a, b) => b.adjustment.effectiveDate.localeCompare(a.adjustment.effectiveDate) || b.adjustment.createdAt.localeCompare(a.adjustment.createdAt))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  getForDelivery: (deliveryId: string): PrepaidAdjustment[] => prepaidAdjustmentRepository.list().filter(item => item.deliveryId === deliveryId),
  listForCustomer: (customerId: string, limit = 20): PrepaidAdjustment[] => prepaidAdjustmentRepository.listForCustomer(customerId).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, limit),

  /** Per-customer totals for the Account tab. Credit value and carry-forward entitlements are reported separately. */
  getCustomerSummary(customerId: string): PrepaidAccountSummary {
    const rows = prepaidAdjustmentRepository.listForCustomer(customerId)
    const sum = (predicate: (item: PrepaidAdjustment) => boolean) => rows.filter(predicate).reduce((total, item) => total + (item.amountPaise ?? 0), 0)
    return {
      pendingCreditPaise: sum(item => item.status === 'pending' && isMoney(item)),
      appliedCreditPaise: sum(item => item.status === 'applied' && isMoney(item)),
      pendingEntitlementUnits: rows.filter(item => item.status === 'pending' && item.type === 'carry_forward').reduce((total, item) => total + (item.entitlement?.quantity ?? 0), 0),
      pendingRefundPaise: sum(item => item.status === 'pending' && item.type === 'refund_pending'),
      pendingCount: rows.filter(item => item.status === 'pending').length,
    }
  },

  /** Creates the adjustments owed for one subscription's skipped / cancelled deliveries. Safe to repeat. */
  reconcileSubscription(subscriptionId: string): void {
    for (const delivery of deliveryRepository.listForSubscription(subscriptionId)) {
      const customer = customerService.getById(delivery.customerId)
      if (delivery.status === 'skipped') postForDelivery(delivery, 'skip', customer)
      if (delivery.status === 'cancelled') postForDelivery(delivery, 'cancel', customer)
    }
  },
  /** Catch-up over recent history for every prepaid customer. Safe to repeat. */
  reconcileAll(): void {
    const since = addDays(todayInBusinessZone(), -RECONCILE_LOOKBACK_DAYS)
    const customers = new Map(customerService.listAll().filter(customer => customer.customerType === 'prepaid').map(customer => [customer.id, customer]))
    for (const delivery of deliveryRepository.list()) {
      if (delivery.deliveryDate < since || !customers.has(delivery.customerId) || !delivery.subscriptionId) continue
      if (delivery.status === 'skipped') postForDelivery(delivery, 'skip', customers.get(delivery.customerId))
      if (delivery.status === 'cancelled') postForDelivery(delivery, 'cancel', customers.get(delivery.customerId))
    }
  },
  /** Skipped/cancelled prepaid deliveries whose adjustment could not be created (e.g. no price snapshot). */
  getIssues(): PrepaidIssue[] {
    const since = addDays(todayInBusinessZone(), -RECONCILE_LOOKBACK_DAYS)
    const customers = new Map(customerService.listAll().filter(customer => customer.customerType === 'prepaid').map(customer => [customer.id, customer]))
    const issues: PrepaidIssue[] = []
    for (const delivery of deliveryRepository.list()) {
      if (delivery.deliveryDate < since || !customers.has(delivery.customerId) || !delivery.subscriptionId) continue
      const trigger: AdjustmentTrigger | null = delivery.status === 'skipped' ? 'skip' : delivery.status === 'cancelled' ? 'cancel' : null
      if (!trigger) continue
      const plan = planAdjustment({ trigger, delivery, customerType: 'prepaid', policy: PREPAID_ADJUSTMENT_POLICY })
      if (plan.kind === 'issue') issues.push({ deliveryId: delivery.id, deliveryDate: delivery.deliveryDate, customerId: delivery.customerId, message: plan.message })
    }
    return issues
  },

  /** Mark a pending credit / carry-forward / manual adjustment as used. Refunds are completed with `completeRefund`. */
  apply(id: string): PrepaidAdjustment {
    const adjustment = requirePending(id)
    if (adjustment.type === 'refund_pending') throw new PrepaidAdjustmentRuleError('Use “Mark refund completed” for refunds.')
    const updated = prepaidAdjustmentRepository.setStatus(id, 'applied')
    if (!updated) throw new PrepaidAdjustmentRuleError('Adjustment not found.')
    return updated
  },
  cancel(id: string): PrepaidAdjustment {
    requirePending(id)
    const updated = prepaidAdjustmentRepository.setStatus(id, 'cancelled')
    if (!updated) throw new PrepaidAdjustmentRuleError('Adjustment not found.')
    return updated
  },
  /** Turns a pending money credit into a pending refund. No payment provider is involved; the refund stays pending until an admin completes it. */
  requestRefund(id: string): PrepaidAdjustment {
    const source = requirePending(id)
    if (!isMoney(source) || !source.amountPaise || source.amountPaise <= 0) throw new PrepaidAdjustmentRuleError('Only a pending money credit can be refunded.')
    prepaidAdjustmentRepository.setStatus(id, 'cancelled', `${source.reason} · converted to a refund`)
    const [refund] = prepaidAdjustmentRepository.append([{
      id: `prepaid-adj-refund:${id}`, customerId: source.customerId, subscriptionId: source.subscriptionId, deliveryId: source.deliveryId, type: 'refund_pending', status: 'pending',
      amountPaise: source.amountPaise, entitlement: null, reason: `Refund requested · ${source.reason}`, effectiveDate: todayInBusinessZone(), dedupeKey: `refund:${id}`,
    }])
    if (!refund) throw new PrepaidAdjustmentRuleError('A refund was already requested for this adjustment.')
    return refund
  },
  /** Explicit admin action: only now is the refund recorded as completed. */
  completeRefund(id: string): PrepaidAdjustment {
    const adjustment = requirePending(id)
    if (adjustment.type !== 'refund_pending') throw new PrepaidAdjustmentRuleError('Only refunds can be marked completed.')
    const updated = prepaidAdjustmentRepository.setStatus(id, 'applied')
    if (!updated) throw new PrepaidAdjustmentRuleError('Adjustment not found.')
    return updated
  },
  /** An admin-entered credit for a prepaid customer (e.g. an operational correction). */
  createManual(input: { customerId: string; amountPaise: Paise; reason: string; effectiveDate?: IsoDate }): PrepaidAdjustment {
    const customer = customerService.getById(input.customerId)
    if (!customer || customer.customerType !== 'prepaid') throw new PrepaidAdjustmentRuleError('Choose a prepaid customer.')
    if (!isValidPaise(input.amountPaise) || input.amountPaise <= 0) throw new PrepaidAdjustmentRuleError('Enter an amount greater than zero.')
    const reason = input.reason.trim()
    if (!reason) throw new PrepaidAdjustmentRuleError('A reason is required.')
    const effectiveDate = input.effectiveDate ?? todayInBusinessZone()
    if (!isIsoDate(effectiveDate)) throw new PrepaidAdjustmentRuleError('Choose a valid date.')
    const [created] = prepaidAdjustmentRepository.append([{
      id: `prepaid-adj-manual-${crypto.randomUUID()}`, customerId: customer.id, subscriptionId: null, deliveryId: null, type: 'manual_adjustment', status: 'pending',
      amountPaise: input.amountPaise, entitlement: null, reason, effectiveDate, dedupeKey: `manual:${crypto.randomUUID()}`,
    }])
    return created
  },
  getOverview(): PrepaidOverview {
    const pending = prepaidAdjustmentRepository.list().filter(item => item.status === 'pending')
    return { pendingCount: pending.length, pendingValuePaise: pending.reduce((total, item) => total + (item.amountPaise ?? 0), 0), refundPendingCount: pending.filter(item => item.type === 'refund_pending').length }
  },
}
