import { addDays, formatDisplayDate, todayInBusinessZone, type IsoDate } from '@/lib/business-time'
import { creditAccountService } from '../credit-accounts/service'
import { customerService } from '../customers/service'
import { deliveryService, type DaySummary, type DeliveryView } from '../deliveries/service'
import { prepaidAdjustmentService } from '../prepaid-adjustments/service'
import { productionPlanningService } from '../production-planning/service'
import type { ProductionUnit } from '../production-planning/types'
import { subscriptionService } from '../subscriptions/service'

export type DashboardIssueKind = 'production' | 'serviceability' | 'inactive_config' | 'credit_posting' | 'prepaid_posting' | 'subscription'
export type DashboardIssue = { id: string; kind: DashboardIssueKind; title: string; detail: string; href: string }
export type TomorrowProductionSlot = { slotName: string; items: Array<{ productName: string; unit: ProductionUnit; requiredBase: number }> }

export type DashboardSummary = {
  today: IsoDate
  tomorrow: IsoDate
  deliveriesToday: DaySummary
  plannedTomorrow: number
  subscriptions: { active: number; paused: number }
  credit: { totalReceivablePaise: number; outstandingAccounts: number }
  tomorrowProduction: TomorrowProductionSlot[]
  issues: DashboardIssue[]
  issueTotal: number
}

/** How many issues the dashboard lists; the rest are only counted. */
const ISSUE_DISPLAY_LIMIT = 8

const KIND_ORDER: DashboardIssueKind[] = ['production', 'serviceability', 'inactive_config', 'credit_posting', 'prepaid_posting', 'subscription']

function deliveryIssues(views: DeliveryView[]): DashboardIssue[] {
  return views.flatMap((view): DashboardIssue[] => {
    const { delivery } = view
    if (delivery.status !== 'scheduled') return []
    const title = `${view.customer?.fullName ?? 'Unknown customer'} · ${view.product?.name ?? 'delivery'} · ${formatDisplayDate(delivery.deliveryDate)}`
    const href = `/deliveries/${delivery.id}`
    const found: DashboardIssue[] = []
    if (view.warning) found.push({ id: `${delivery.id}-serviceability`, kind: 'serviceability', title, detail: view.warning, href })
    const inactive = (Object.entries({ product: 'product', variant: 'variant', slot: 'delivery slot', profile: 'fulfilment profile', area: 'service area' }) as Array<[keyof DeliveryView['inactive'], string]>).filter(([key]) => view.inactive[key]).map(([, label]) => label)
    if (inactive.length) found.push({ id: `${delivery.id}-inactive`, kind: 'inactive_config', title, detail: `Uses an inactive ${inactive.join(', ')}.`, href })
    return found
  })
}

/** One read-only roll-up for the landing page. Every figure comes from an aggregate service method; no row lists are built in the UI. */
export const dashboardService = {
  getSummary(): DashboardSummary {
    const today = todayInBusinessZone()
    const tomorrow = addDays(today, 1)
    const customers = new Map(customerService.listAll().map(customer => [customer.id, customer]))

    const deliveriesToday = deliveryService.getDaySummary(today)
    const plannedTomorrow = deliveryService.getDaySummary(tomorrow).planned
    const tomorrowPlan = productionPlanningService.getPlanForDate({ date: tomorrow, slotId: '' }).plan
    const todayPlan = productionPlanningService.getPlanForDate({ date: today, slotId: '' }).plan

    const counts = subscriptionService.getStatusCounts()
    const attention = subscriptionService.getAttentionItems()

    const credit = creditAccountService.getSummary()

    const issues: DashboardIssue[] = [
      ...[...tomorrowPlan.issues, ...todayPlan.issues.filter(issue => !tomorrowPlan.issues.some(other => other.kind === issue.kind && other.variantId === issue.variantId))].map((issue): DashboardIssue => ({
        id: `production-${issue.kind}-${issue.productId}-${issue.variantId}`, kind: 'production', title: `${issue.productName} ${issue.variantName}`, detail: `${issue.message} ${issue.deliveryCount} scheduled ${issue.deliveryCount === 1 ? 'delivery is' : 'deliveries are'} left out of the production total.`, href: `/products/${issue.productId}`,
      })),
      ...deliveryIssues([...deliveryService.getByDate(today), ...deliveryService.getByDate(tomorrow)]),
      ...creditAccountService.getAllIssues().map((issue): DashboardIssue => ({ id: `credit-${issue.deliveryId}`, kind: 'credit_posting', title: `${customers.get(issue.customerId)?.fullName ?? 'Credit customer'} · ${formatDisplayDate(issue.deliveryDate)}`, detail: `${issue.message} It was not charged.`, href: `/deliveries/${issue.deliveryId}` })),
      ...prepaidAdjustmentService.getIssues().map((issue): DashboardIssue => ({ id: `prepaid-${issue.deliveryId}`, kind: 'prepaid_posting', title: `${customers.get(issue.customerId)?.fullName ?? 'Prepaid customer'} · ${formatDisplayDate(issue.deliveryDate)}`, detail: issue.message, href: `/deliveries/${issue.deliveryId}` })),
      ...attention.map((item): DashboardIssue => ({ id: item.id, kind: 'subscription', title: item.title, detail: item.detail, href: `/subscriptions/${item.subscriptionId}` })),
    ].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))

    return {
      today, tomorrow, deliveriesToday, plannedTomorrow,
      subscriptions: { active: counts.active, paused: counts.paused },
      credit: { totalReceivablePaise: credit.totalReceivablePaise, outstandingAccounts: credit.outstandingAccounts },
      tomorrowProduction: tomorrowPlan.slots.map(slot => ({ slotName: slot.slotName, items: slot.products.map(product => ({ productName: product.productName, unit: product.unit, requiredBase: product.requiredBase })) })),
      issues: issues.slice(0, ISSUE_DISPLAY_LIMIT),
      issueTotal: issues.length,
    }
  },
}
