import { formatDisplayDate, isIsoDate, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { cutoffRuleService, deliverySlotService, fulfilmentProfileService, serviceAreaService, subscriptionRuleService } from '../configuration/mock-store'
import type { CutoffRule, DeliverySlot, FulfilmentProfile, ServiceArea } from '../configuration/types'
import { customerService } from '../customers/service'
import type { Customer } from '../customers/types'
import { productService } from '../products/service'
import type { Product, ProductVariant, PurchaseMethod } from '../products/types'
import { deliveryService } from '../deliveries/service'
import { prepaidAdjustmentService } from '../prepaid-adjustments/service'
import { resolveSubscriptionEligibility, type EligibilityResult } from './eligibility'
import { subscriptionRepository } from './mock-repository'
import { buildDeliveryPreview, getNextDeliveryDate } from './schedule'
import {
  SCHEDULE_TYPE_LABELS,
  type DeliveryPreviewRow, type ScheduleType, type Subscription, type SubscriptionDeliveryException, type SubscriptionInput, type SubscriptionScheduleConfig, type SubscriptionStatus,
} from './types'

export class SubscriptionRuleError extends Error {}

export type ScheduleOption = { value: ScheduleType; label: string }

/** Everything the form needs to know about a customer + product pairing, derived from existing configuration. */
export type SubscriptionContext = {
  customer: Customer | undefined
  product: Product | undefined
  variants: ProductVariant[]
  profile: FulfilmentProfile | undefined
  serviceArea: ServiceArea | undefined
  cutoffRule: CutoffRule | undefined
  scheduleOptions: ScheduleOption[]
  slots: DeliverySlot[]
  eligibility: EligibilityResult | undefined
}

export type SubscriptionView = {
  subscription: Subscription
  status: SubscriptionStatus
  customer: Customer | undefined
  product: Product | undefined
  variant: ProductVariant | undefined
  slot: DeliverySlot | undefined
  profile: FulfilmentProfile | undefined
  nextDelivery: IsoDate | null
}

export type SubscriptionListQuery = {
  search: string
  status: SubscriptionStatus | ''
  productId: string
  scheduleType: ScheduleType | ''
  slotId: string
  page: number
  pageSize: number
}

/** Pause with a resume date ends by itself once that date arrives, so no manual Resume is needed. */
function isAutoResumed(subscription: Subscription, today: IsoDate): boolean {
  const latest = subscription.pauses[subscription.pauses.length - 1]
  return subscription.status === 'paused' && latest?.resumeDate != null && latest.resumeDate <= today
}

export function deriveStatus(subscription: Subscription, today: IsoDate): SubscriptionStatus {
  if (subscription.status === 'cancelled') return 'cancelled'
  if (subscription.status === 'paused' && !isAutoResumed(subscription, today)) return 'paused'
  return subscription.startDate > today ? 'upcoming' : 'active'
}

function resolveContext({ customerId, productId, existing, purchaseMethod }: { customerId: string; productId: string; existing?: Subscription; purchaseMethod?: PurchaseMethod }): SubscriptionContext {
  const customer = customerId ? customerService.getById(customerId) : undefined
  const product = productId ? productService.getById(productId) : undefined
  const slots = deliverySlotService.list()
  if (!product) return { customer, product, variants: [], profile: undefined, serviceArea: undefined, cutoffRule: undefined, scheduleOptions: [], slots, eligibility: undefined }

  const profile = fulfilmentProfileService.getById(product.fulfilmentProfileId)
  const serviceArea = profile ? serviceAreaService.getById(profile.serviceAreaId) : undefined
  const cutoffRule = profile?.cutoffRuleId ? cutoffRuleService.getById(profile.cutoffRuleId) : undefined
  const keepVariantId = existing && existing.productId === product.id ? existing.variantId : undefined
  const variants = product.variants.filter(variant => variant.status === 'active' || variant.id === keepVariantId)
  const keepScheduleType = existing && existing.productId === product.id ? existing.schedule.scheduleType : undefined
  const scheduleOptions: ScheduleOption[] = []
  for (const ruleId of product.subscriptionRuleIds) {
    const rule = subscriptionRuleService.getById(ruleId)
    if (!rule || scheduleOptions.some(option => option.value === rule.systemType)) continue
    if (rule.status === 'active' || rule.systemType === keepScheduleType) scheduleOptions.push({ value: rule.systemType, label: SCHEDULE_TYPE_LABELS[rule.systemType] })
  }
  const eligibility = customer ? resolveSubscriptionEligibility({ customer, product, fulfilmentProfile: profile, serviceArea, cutoffRule, deliverySlots: slots, purchaseMethod }) : undefined
  return { customer, product, variants, profile, serviceArea, cutoffRule, scheduleOptions, slots, eligibility }
}

function normalizeSchedule(schedule: SubscriptionScheduleConfig): SubscriptionScheduleConfig {
  switch (schedule.scheduleType) {
    case 'daily':
      return { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }
    case 'alternate_days':
      return { scheduleType: 'alternate_days', weekdays: [], alternatePatternDate: schedule.alternatePatternDate }
    case 'custom_weekdays':
      return { scheduleType: 'custom_weekdays', weekdays: [...new Set(schedule.weekdays)].sort((a, b) => a - b), alternatePatternDate: null }
  }
}

/** Authoritative create/edit validation. The form mirrors these rules for UX only. */
function validateInput(input: SubscriptionInput, existing: Subscription | undefined, today: IsoDate): SubscriptionInput {
  const customerId = existing?.customerId ?? input.customerId
  const context = resolveContext({ customerId, productId: input.productId, existing })
  const { customer, product, eligibility } = context
  if (!customer) throw new SubscriptionRuleError('Select a customer.')
  if (!existing && customer.status !== 'active') throw new SubscriptionRuleError('Subscriptions can only be created for active customers.')
  if (!product || !eligibility) throw new SubscriptionRuleError('Select a product.')
  if (!eligibility.serviceable) throw new SubscriptionRuleError(eligibility.reason ?? 'This subscription cannot be delivered.')
  if (!context.variants.some(variant => variant.id === input.variantId)) throw new SubscriptionRuleError('Select an active variant of this product.')

  const schedule = normalizeSchedule(input.schedule)
  if (!context.scheduleOptions.some(option => option.value === schedule.scheduleType)) throw new SubscriptionRuleError('This product does not offer the selected schedule.')
  if (schedule.scheduleType === 'custom_weekdays' && (!schedule.weekdays.length || schedule.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) throw new SubscriptionRuleError('Select at least one delivery day.')
  if (schedule.scheduleType === 'alternate_days' && (!schedule.alternatePatternDate || !isIsoDate(schedule.alternatePatternDate))) throw new SubscriptionRuleError('Choose the start pattern date.')

  let deliverySlotId: string | null = null
  if (eligibility.slotRequired) {
    const unchangedSlot = existing && existing.deliverySlotId === input.deliverySlotId && existing.productId === input.productId
    if (!input.deliverySlotId || !(eligibility.allowedSlotIds.includes(input.deliverySlotId) || (unchangedSlot && eligibility.inactiveSlotIds.includes(input.deliverySlotId)))) throw new SubscriptionRuleError('Select a delivery slot available for the customer’s PIN code.')
    deliverySlotId = input.deliverySlotId
  }

  if (!isIsoDate(input.startDate)) throw new SubscriptionRuleError('Choose a start date.')
  if ((!existing || input.startDate !== existing.startDate) && input.startDate < today) throw new SubscriptionRuleError('The start date cannot be in the past.')

  return { customerId, productId: input.productId, variantId: input.variantId, schedule, deliverySlotId, startDate: input.startDate }
}

function requireSubscription(id: string): Subscription {
  const subscription = subscriptionRepository.get(id)
  if (!subscription) throw new SubscriptionRuleError('Subscription not found.')
  return subscription
}
function commit(id: string, changes: Parameters<typeof subscriptionRepository.replace>[1]): Subscription {
  const updated = subscriptionRepository.replace(id, changes)
  if (!updated) throw new SubscriptionRuleError('Subscription not found.')
  // Delivery instances are derived from the schedule, so any schedule change re-aligns them.
  deliveryService.reconcileSubscriptionChanges(id)
  return updated
}

function toView(subscription: Subscription, today: IsoDate): SubscriptionView {
  const product = productService.getById(subscription.productId)
  const exceptions = subscriptionRepository.listExceptions(subscription.id)
  return {
    subscription,
    status: deriveStatus(subscription, today),
    customer: customerService.getById(subscription.customerId),
    product,
    variant: product?.variants.find(variant => variant.id === subscription.variantId),
    slot: subscription.deliverySlotId ? deliverySlotService.getById(subscription.deliverySlotId) : undefined,
    profile: product ? fulfilmentProfileService.getById(product.fulfilmentProfileId) : undefined,
    nextDelivery: subscription.status === 'cancelled' ? null : getNextDeliveryDate(subscription, exceptions, today),
  }
}

export const subscriptionService = {
  list({ search, status, productId, scheduleType, slotId, page, pageSize }: SubscriptionListQuery): { rows: SubscriptionView[]; total: number } {
    const today = todayInBusinessZone()
    const term = search.trim().toLowerCase()
    const matches = subscriptionRepository.list()
      .filter(item => (!productId || item.productId === productId) && (!scheduleType || item.schedule.scheduleType === scheduleType) && (!slotId || item.deliverySlotId === slotId) && (!status || deriveStatus(item, today) === status))
      .map(item => toView(item, today))
      .filter(view => !term || [view.customer?.fullName, view.customer?.mobile, view.product?.name, view.variant?.name].join(' ').toLowerCase().includes(term))
      .sort((a, b) => (a.customer?.fullName ?? '').localeCompare(b.customer?.fullName ?? '') || (a.product?.name ?? '').localeCompare(b.product?.name ?? ''))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  /** Status counts without building any views. */
  getStatusCounts(): Record<SubscriptionStatus, number> {
    const today = todayInBusinessZone()
    const counts: Record<SubscriptionStatus, number> = { active: 0, paused: 0, cancelled: 0, upcoming: 0 }
    for (const item of subscriptionRepository.list()) counts[deriveStatus(item, today)] += 1
    return counts
  },
  /** Open subscriptions an admin should look at: open-ended pauses, inactive customers, or delivery that is no longer possible. */
  getAttentionItems(): Array<{ id: string; subscriptionId: string; title: string; detail: string }> {
    const today = todayInBusinessZone()
    const items: Array<{ id: string; subscriptionId: string; title: string; detail: string }> = []
    for (const subscription of subscriptionRepository.list()) {
      const status = deriveStatus(subscription, today)
      if (status === 'cancelled') continue
      const customer = customerService.getById(subscription.customerId)
      const product = productService.getById(subscription.productId)
      const title = `${customer?.fullName ?? 'Unknown customer'} · ${product?.name ?? 'subscription'}`
      const pause = subscription.pauses[subscription.pauses.length - 1]
      if (status === 'paused' && pause && pause.resumeDate === null) items.push({ id: `${subscription.id}-paused`, subscriptionId: subscription.id, title, detail: `Paused since ${formatDisplayDate(pause.fromDate)} with no resume date.` })
      if (customer?.status === 'inactive') items.push({ id: `${subscription.id}-inactive`, subscriptionId: subscription.id, title, detail: 'Customer is inactive but the subscription is still open.' })
      if (status === 'active' || status === 'upcoming') {
        const eligibility = resolveContext({ customerId: subscription.customerId, productId: subscription.productId, existing: subscription }).eligibility
        if (eligibility && !eligibility.serviceable) items.push({ id: `${subscription.id}-unserviceable`, subscriptionId: subscription.id, title, detail: eligibility.reason ?? 'Delivery is no longer available.' })
      }
    }
    return items
  },
  listForCustomer: (customerId: string): SubscriptionView[] => {
    const today = todayInBusinessZone()
    return subscriptionRepository.listByCustomer(customerId).map(item => toView(item, today))
  },
  /** Active-subscription counts per customer for the customer list, in one pass (no per-row lookups). */
  activeCountsByCustomer(): Map<string, number> {
    const counts = new Map<string, number>()
    for (const item of subscriptionRepository.list()) {
      if (item.status === 'cancelled') continue
      counts.set(item.customerId, (counts.get(item.customerId) ?? 0) + 1)
    }
    return counts
  },
  getView(id: string): SubscriptionView | undefined {
    const subscription = subscriptionRepository.get(id)
    return subscription ? toView(subscription, todayInBusinessZone()) : undefined
  },
  getById: (id: string) => subscriptionRepository.get(id),
  getPreview(id: string, limit = 14): { rows: DeliveryPreviewRow[]; exceptions: SubscriptionDeliveryException[] } {
    const subscription = requireSubscription(id)
    const exceptions = subscriptionRepository.listExceptions(id)
    return { rows: buildDeliveryPreview({ subscription, exceptions, today: todayInBusinessZone(), limit }), exceptions }
  },
  resolveContext,
  /** Active products offering Subscription; the product already on an edited subscription is kept selectable. */
  listSubscribableProducts(keepProductId?: string): Product[] {
    return productService.list().filter(product => product.id === keepProductId || (product.status === 'active' && product.purchaseMethods.includes('subscription')))
  },
  create(input: SubscriptionInput): Subscription {
    const valid = validateInput(input, undefined, todayInBusinessZone())
    const created = subscriptionRepository.insert({ ...valid, status: 'active', pauses: [], cancellation: null })
    deliveryService.reconcileSubscriptionChanges(created.id)
    return created
  },
  update(id: string, input: SubscriptionInput): Subscription {
    const existing = requireSubscription(id)
    if (existing.status === 'cancelled') throw new SubscriptionRuleError('Cancelled subscriptions cannot be edited.')
    const valid = validateInput(input, existing, todayInBusinessZone())
    return commit(id, { productId: valid.productId, variantId: valid.variantId, schedule: valid.schedule, deliverySlotId: valid.deliverySlotId, startDate: valid.startDate })
  },
  pause(id: string, { fromDate, resumeDate, reason }: { fromDate: IsoDate; resumeDate: IsoDate | null; reason: string }): Subscription {
    const subscription = requireSubscription(id)
    const today = todayInBusinessZone()
    const current = deriveStatus(subscription, today)
    if (current !== 'active' && current !== 'upcoming') throw new SubscriptionRuleError('Only active subscriptions can be paused.')
    if (!isIsoDate(fromDate) || fromDate < today) throw new SubscriptionRuleError('Pause from date cannot be in the past.')
    if (resumeDate !== null && (!isIsoDate(resumeDate) || resumeDate <= fromDate)) throw new SubscriptionRuleError('Resume date must be after the pause date.')
    return commit(id, { status: 'paused', pauses: [...subscription.pauses, { id: `pause-${crypto.randomUUID()}`, fromDate, resumeDate, reason: reason.trim() }] })
  },
  resume(id: string, { resumeDate }: { resumeDate: IsoDate }): Subscription {
    const subscription = requireSubscription(id)
    const today = todayInBusinessZone()
    if (deriveStatus(subscription, today) !== 'paused') throw new SubscriptionRuleError('Only paused subscriptions can be resumed.')
    const open = subscription.pauses[subscription.pauses.length - 1]
    if (!open) throw new SubscriptionRuleError('No pause was found for this subscription.')
    if (!isIsoDate(resumeDate) || resumeDate < today) throw new SubscriptionRuleError('Resume date cannot be in the past.')
    if (resumeDate < open.fromDate) throw new SubscriptionRuleError('Resume date cannot be before the pause starts.')
    return commit(id, { status: 'active', pauses: subscription.pauses.map(pause => pause.id === open.id ? { ...pause, resumeDate } : pause) })
  },
  cancel(id: string, { effectiveDate, reason }: { effectiveDate: IsoDate; reason: string }): Subscription {
    const subscription = requireSubscription(id)
    if (subscription.status === 'cancelled') throw new SubscriptionRuleError('This subscription is already cancelled.')
    if (!isIsoDate(effectiveDate) || effectiveDate < todayInBusinessZone()) throw new SubscriptionRuleError('Effective date cannot be in the past.')
    const cancelled = commit(id, { status: 'cancelled', cancellation: { effectiveDate, reason: reason.trim() } })
    prepaidAdjustmentService.reconcileSubscription(id)
    return cancelled
  },
  addDeliveryException(input: { subscriptionId: string; date: IsoDate; type: 'skip'; reason?: string }): SubscriptionDeliveryException {
    const subscription = requireSubscription(input.subscriptionId)
    if (subscription.status === 'cancelled') throw new SubscriptionRuleError('Cancelled subscriptions have no upcoming deliveries.')
    const { rows } = subscriptionService.getPreview(input.subscriptionId, 60)
    const target = rows.find(row => row.date === input.date)
    if (!target) throw new SubscriptionRuleError('That date is not an upcoming delivery.')
    if (target.state !== 'scheduled') throw new SubscriptionRuleError(target.state === 'skipped' ? 'This delivery is already skipped.' : 'This delivery is paused.')
    const exception = subscriptionRepository.insertException({ subscriptionId: input.subscriptionId, date: input.date, slotId: target.slotId, type: input.type, reason: input.reason?.trim() ?? '' })
    deliveryService.reconcileSubscriptionChanges(input.subscriptionId)
    prepaidAdjustmentService.reconcileSubscription(input.subscriptionId)
    return exception
  },
}
