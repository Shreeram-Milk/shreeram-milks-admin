import { formatINR } from '@/lib/money'
import type { DashboardData } from './api'

export type AttentionItem = { id: string; title: string; detail: string; href: string }

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** The things staff should look at now, one line each, with where to go. Nothing is listed for a count of zero. */
export function attentionItems(data: DashboardData): AttentionItem[] {
  const { money, attention } = data
  const items: AttentionItem[] = []
  if (attention.overdueOrders > 0) {
    items.push({ id: 'overdue', title: `${plural(attention.overdueOrders, 'past order is', 'past orders are')} still open`, detail: 'Their delivery day has gone by but they are not marked delivered or missed. Close them so the numbers are right.', href: '/orders' })
  }
  if (attention.creditLimitSkips > 0) {
    items.push({ id: 'credit-skips', title: `${plural(attention.creditLimitSkips, 'subscription day was', 'subscription days were')} skipped for the credit limit`, detail: 'The customer is not getting those deliveries. You may want to call them or raise the limit.', href: '/subscriptions' })
  }
  if (money.refundsToSend > 0) {
    items.push({ id: 'refunds', title: `${plural(money.refundsToSend, 'refund', 'refunds')} to send (${formatINR(money.refundsToSendPaise)})`, detail: 'Send the money in PhonePe, then record it so the customer is told.', href: '/prepaid-adjustments' })
  }
  if (attention.openTickets > 0) {
    items.push({ id: 'tickets', title: `${plural(attention.openTickets, 'support ticket', 'support tickets')} waiting`, detail: 'Customers are waiting for a reply.', href: '/support' })
  }
  return items
}
