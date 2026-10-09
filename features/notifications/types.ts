import type { IsoDate } from '@/lib/business-time'

export type NotificationEvent = 'order_confirmed' | 'out_for_delivery' | 'delivered' | 'delivery_skipped' | 'payment_failed' | 'subscription_paused' | 'subscription_resumed' | 'trial_ending'
export type Placeholder = 'customerName' | 'orderNumber' | 'deliveryDate' | 'productName'

/** The message sent automatically when an event happens. Events are fixed by the system; staff edit the wording. */
export type NotificationTemplate = {
  id: NotificationEvent
  pushEnabled: boolean
  smsEnabled: boolean
  title: string
  titleGujarati: string
  body: string
  bodyGujarati: string
  status: 'active' | 'inactive'
  updatedAt: string
}
export type NotificationTemplateInput = Omit<NotificationTemplate, 'updatedAt'>

export type BroadcastAudience = 'all' | 'prepaid' | 'credit' | 'subscribers'
export type BroadcastChannel = 'push' | 'sms' | 'both'
export type BroadcastStatus = 'draft' | 'scheduled' | 'cancelled'

export const BROADCAST_AUDIENCE_LABELS: Record<BroadcastAudience, string> = { all: 'All active customers', prepaid: 'Prepaid customers', credit: 'Credit customers', subscribers: 'Customers with an active subscription' }
export const BROADCAST_CHANNEL_LABELS: Record<BroadcastChannel, string> = { push: 'App notification', sms: 'SMS', both: 'App notification and SMS' }
export const BROADCAST_STATUS_LABELS: Record<BroadcastStatus, string> = { draft: 'Draft', scheduled: 'Scheduled', cancelled: 'Cancelled' }
/** What a broadcast can move to next. Cancelled is final; a scheduled one can go back to draft to be edited. */
export const BROADCAST_TRANSITIONS: Record<BroadcastStatus, BroadcastStatus[]> = { draft: ['scheduled', 'cancelled'], scheduled: ['draft', 'cancelled'], cancelled: [] }

/** A one-off message to a group of customers, such as a festive greeting or a service notice. */
export type Broadcast = {
  id: string
  title: string
  titleGujarati: string
  body: string
  bodyGujarati: string
  audience: BroadcastAudience
  channel: BroadcastChannel
  status: BroadcastStatus
  /** Business-zone date and 24-hour time ("18:30") the message should go out; empty until scheduled. */
  scheduledDate: IsoDate | ''
  scheduledTime: string
  updatedAt: string
}
export type BroadcastInput = Omit<Broadcast, 'id' | 'updatedAt'> & { id?: string }
