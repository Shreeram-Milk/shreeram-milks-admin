import { formatINR } from '@/lib/money'
import type { DashboardData } from './api'
import { plural, t } from './messages'

export type AttentionItem = { id: string; title: string; detail: string; href: string }

/** The things staff should look at now, one line each, with where to go. Nothing is listed for a count of zero. */
export function attentionItems(data: DashboardData): AttentionItem[] {
  const { money, attention } = data
  const items: AttentionItem[] = []
  if (attention.overdueOrders > 0) {
    items.push({ id: 'overdue', title: plural(attention.overdueOrders, 'overdueTitleOne', 'overdueTitleMany'), detail: t('overdueDetail'), href: '/orders' })
  }
  if (attention.creditLimitSkips > 0) {
    items.push({ id: 'credit-skips', title: plural(attention.creditLimitSkips, 'creditSkipsOne', 'creditSkipsMany'), detail: t('creditSkipsDetail'), href: '/subscriptions' })
  }
  if (money.refundsToSend > 0) {
    items.push({ id: 'refunds', title: plural(money.refundsToSend, 'refundsTitleOne', 'refundsTitleMany', { amount: formatINR(money.refundsToSendPaise) }), detail: t('refundsDetail'), href: '/prepaid-adjustments' })
  }
  if (attention.openTickets > 0) {
    items.push({ id: 'tickets', title: plural(attention.openTickets, 'ticketsOne', 'ticketsMany'), detail: t('ticketsDetail'), href: '/support' })
  }
  return items
}
