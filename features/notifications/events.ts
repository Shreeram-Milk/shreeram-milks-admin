import type { NotificationEvent, Placeholder } from './types'

export type EventDefinition = { id: NotificationEvent; label: string; trigger: string; placeholders: Placeholder[]; title: string; body: string }

/** Every automatic message the system can send, with the details each one is allowed to mention. */
export const NOTIFICATION_EVENTS: EventDefinition[] = [
  { id: 'order_confirmed', label: 'Order confirmed', trigger: 'When an order is placed and confirmed.', placeholders: ['customerName', 'orderNumber', 'deliveryDate'], title: 'Order confirmed', body: 'Hi {{customerName}}, order {{orderNumber}} is confirmed for {{deliveryDate}}.' },
  { id: 'out_for_delivery', label: 'Out for delivery', trigger: 'When a delivery leaves for the customer.', placeholders: ['customerName', 'orderNumber'], title: 'On its way', body: 'Hi {{customerName}}, your fresh delivery is on its way.' },
  { id: 'delivered', label: 'Delivered', trigger: 'When a delivery is marked delivered.', placeholders: ['customerName', 'productName', 'deliveryDate'], title: 'Delivered', body: 'Hi {{customerName}}, your {{productName}} was delivered on {{deliveryDate}}.' },
  { id: 'delivery_skipped', label: 'Delivery skipped', trigger: 'When a delivery is skipped or not delivered.', placeholders: ['customerName', 'productName', 'deliveryDate'], title: 'Delivery update', body: 'Hi {{customerName}}, your {{productName}} delivery on {{deliveryDate}} did not go ahead.' },
  { id: 'payment_failed', label: 'Payment failed', trigger: 'When a payment does not go through.', placeholders: ['customerName', 'orderNumber'], title: 'Payment failed', body: 'Hi {{customerName}}, the payment for {{orderNumber}} did not go through. Please try again.' },
  { id: 'subscription_paused', label: 'Subscription paused', trigger: 'When a subscription is paused.', placeholders: ['customerName', 'productName'], title: 'Subscription paused', body: 'Hi {{customerName}}, your {{productName}} subscription is paused.' },
  { id: 'subscription_resumed', label: 'Subscription resumed', trigger: 'When a paused subscription resumes.', placeholders: ['customerName', 'productName', 'deliveryDate'], title: 'Subscription resumed', body: 'Hi {{customerName}}, your {{productName}} deliveries resume on {{deliveryDate}}.' },
  { id: 'trial_ending', label: 'Trial ending soon', trigger: 'A day before a trial ends.', placeholders: ['customerName', 'productName', 'deliveryDate'], title: 'Your trial ends soon', body: 'Hi {{customerName}}, your {{productName}} trial ends on {{deliveryDate}}. Subscribe to keep your deliveries going.' },
]

export const PLACEHOLDER_LABELS: Record<Placeholder, string> = { customerName: 'Customer name', orderNumber: 'Order number', deliveryDate: 'Date', productName: 'Product' }
export const PLACEHOLDER_SAMPLES: Record<Placeholder, string> = { customerName: 'Priya', orderNumber: 'ORD-1001', deliveryDate: '12 Oct 2026', productName: 'Fresh Cow Milk' }
export const eventById = (id: NotificationEvent) => NOTIFICATION_EVENTS.find(event => event.id === id)
