import { apiRequest } from '@/lib/api-client'
import { liveLabels } from '@/lib/i18n/core'
import { t, type SubscriptionKey } from './messages'
import type { ListResult } from '../configuration/api'

export type SubscriptionKind = 'subscription' | 'trial'
export type SubscriptionState = 'active' | 'paused' | 'completed' | 'cancelled'
export type ScheduleType = 'daily' | 'alternate_days' | 'custom_weekdays'
export type SkipReason = 'customer' | 'admin' | 'order_cancelled' | 'credit_limit' | 'not_deliverable'
export type DayLineState = 'upcoming' | 'placed' | 'out_for_delivery' | 'delivered' | 'missed' | 'skipped' | 'paused'

export type SubscriptionLine = { id: string; slotId: string; slotName: string; startTime: string; endTime: string; quantity: number }
type Address = { recipientName: string; recipientPhone: string; addressLine1: string; addressLine2: string; landmark: string; city: string; pinCode: string; doorstepNote: string }

/** One row of the list. `status` there is the stored one; `paused` says a pause covers today. */
export type SubscriptionRow = {
  id: string; number: string; kind: SubscriptionKind; customerId: string; customerName: string; customerPhone: string
  productName: string; variantName: string; unitPricePaise: number; planName: string; scheduleType: ScheduleType; weekdays: number[]
  deliveriesPerLine: number; startDate: string; address: Address; paymentMethod: 'credit' | 'online'; totalPaise: number
  status: 'active' | 'completed' | 'cancelled'; paused: boolean; usedDeliveries: number; deliveredDeliveries: number; alerts: number; createdAt: string; lines: SubscriptionLine[]
  /** The nearest delivery whose order is made and still on its way, or null. */
  nextDelivery: { date: string; slotName: string } | null
}
/** A day the system had to skip, for staff to follow up: over the credit limit, or it could no longer be delivered. */
export type SubscriptionAlert = { subscriptionId: string; subscriptionNumber: string; customerName: string; date: string; slotName: string; reason: SkipReason; createdAt: string }

/** One window on one day. `changeUntil`: until when it can still be skipped or brought back (its cancel deadline). */
export type DayLine = SubscriptionLine & { lineId: string; state: DayLineState; skipReason: SkipReason | null; orderId: string | null; orderNumber: string | null; canChange: boolean; changeUntil: string | null }
export type SubscriptionDetail = {
  id: string; number: string; kind: SubscriptionKind; status: SubscriptionState; customerId: string; customerName: string; customerPhone: string; paymentId: string | null
  productId: string; productName: string; variantName: string; unitPricePaise: number; planName: string; scheduleType: ScheduleType; weekdays: number[]
  deliveriesPerLine: number; startDate: string; endDate: string | null; address: Address; paymentMethod: 'credit' | 'online'; totalPaise: number
  cancelledAt: string | null; cancelReason: string; createdAt: string
  lines: Array<SubscriptionLine & { delivered: number; used: number; remaining: number; endDate: string | null }>
  pauses: Array<{ id: string; fromDate: string; untilDate: string | null }>; openPause: { fromDate: string; untilDate: string | null } | null
  nextDelivery: { date: string; slotName: string; quantity: number } | null
  days: Array<{ date: string; lines: DayLine[] }>
  activity: Array<{ kind: string; detail: Record<string, unknown>; createdAt: string; byStaff: boolean }>
  deliveries: Array<{ orderId: string; orderNumber: string; lineId: string; date: string; status: string }>
}

export type SubscriptionListParams = { search: string; kind: SubscriptionKind; status: SubscriptionState | ''; page: number; pageSize: number }
export type JobResult = { checked: number; failures: number; created: number; skipped: number }

const path = (id: string, action = '') => `/admin/subscriptions/${encodeURIComponent(id)}${action}`
const act = async (id: string, action: string, body: object) => (await apiRequest<{ subscription: SubscriptionDetail }>(path(id, `/${action}`), { method: 'POST', body })).subscription

export const subscriptionAdminApi = {
  /** A page of one kind, plus how many are in each state (with every filter but the state) for the tabs. */
  list({ search, kind, status, page, pageSize }: SubscriptionListParams): Promise<ListResult<SubscriptionRow> & { counts: Record<SubscriptionState, number>; alerts: SubscriptionAlert[] }> {
    const query = new URLSearchParams({ kind, page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    return apiRequest(`/admin/subscriptions?${query}`)
  },
  async get(id: string): Promise<SubscriptionDetail> { return (await apiRequest<{ subscription: SubscriptionDetail }>(path(id))).subscription },
  /** Makes the coming days' delivery orders now, instead of waiting for the automatic run (every few minutes). */
  async runNow(): Promise<JobResult> { return (await apiRequest<{ result: JobResult }>('/admin/subscriptions/run', { method: 'POST', body: {} })).result },
  skip: (id: string, date: string, lineId?: string) => act(id, 'skip', { date, lineId }),
  unskip: (id: string, date: string, lineId?: string) => act(id, 'unskip', { date, lineId }),
  pause: (id: string, fromDate: string, untilDate: string | null) => act(id, 'pause', { fromDate, untilDate }),
  resume: (id: string, fromDate: string) => act(id, 'resume', { fromDate }),
  cancel: (id: string, reason: string) => act(id, 'cancel', { reason }),
}

// The words are read when used, so they follow the admin's language.
export const KIND_TEXT: Record<SubscriptionKind, { readonly singular: string; readonly plural: string; path: string }> = {
  subscription: { get singular() { return t('subscription') }, get plural() { return t('subscriptions') }, path: '/subscriptions' },
  trial: { get singular() { return t('trial') }, get plural() { return t('trials') }, path: '/trials' },
}
export const SUBSCRIPTION_STATES: SubscriptionState[] = ['active', 'paused', 'completed', 'cancelled']
export const STATE_LABELS = liveLabels(t, { active: 'stateActive', paused: 'statePaused', completed: 'stateCompleted', cancelled: 'stateCancelled' } satisfies Record<SubscriptionState, SubscriptionKey>)
export const STATE_TONE: Record<SubscriptionState, 'pending' | 'delivered' | 'cancelled'> = { active: 'delivered', paused: 'pending', completed: 'delivered', cancelled: 'cancelled' }
export const DAY_LABELS = liveLabels(t, { upcoming: 'dayUpcoming', placed: 'dayPlaced', out_for_delivery: 'dayOut', delivered: 'dayDelivered', missed: 'dayMissed', skipped: 'daySkipped', paused: 'dayPaused' } satisfies Record<DayLineState, SubscriptionKey>)
export const SKIP_REASON_LABELS = liveLabels(t, {
  customer: 'skipCustomer', admin: 'skipAdmin', order_cancelled: 'skipOrderCancelled', credit_limit: 'skipCreditLimit', not_deliverable: 'skipNotDeliverable',
} satisfies Record<SkipReason, SubscriptionKey>)
const WEEKDAYS: SubscriptionKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export function scheduleText(type: ScheduleType, weekdays: number[]): string {
  if (type === 'daily') return t('everyDay')
  if (type === 'alternate_days') return t('everyOtherDay')
  return weekdays.map(day => t(WEEKDAYS[day - 1] ?? 'mon')).join(', ')
}
export const linesText = (lines: SubscriptionLine[]) => lines.map(line => `${line.slotName} × ${line.quantity}`).join(' · ')
export const ACTIVITY_LABELS: Readonly<Record<string, string>> = liveLabels(t, {
  started: 'actStarted', paused: 'actPaused', resumed: 'actResumed', skipped: 'actSkipped', skip_undone: 'actSkipUndone', cancelled: 'actCancelled',
  completed: 'actCompleted', refund_due: 'actRefundDue', credit_limit_skipped: 'actCreditSkipped',
})
