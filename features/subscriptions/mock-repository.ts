import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { Subscription, SubscriptionDeliveryException } from './types'

const SUBSCRIPTIONS_KEY = 'shreeram-admin-subscriptions-v1'
const EXCEPTIONS_KEY = 'shreeram-admin-subscription-exceptions-v1'
const now = () => new Date().toISOString()

type SeedFields = Pick<Subscription, 'id' | 'customerId' | 'productId' | 'variantId' | 'schedule' | 'deliverySlotId' | 'startDate'> & Partial<Pick<Subscription, 'status' | 'pauses'>>
const seedSubscription = (record: SeedFields): Subscription =>
  ({ status: 'active', pauses: [], cancellation: null, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z', ...record })

const seedSubscriptions: Subscription[] = [
  seedSubscription({ id: 'sub-rakesh-cow', customerId: 'customer-rakesh', productId: 'product-cow-milk', variantId: 'cow-1000', schedule: { scheduleType: 'daily', weekdays: [], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: '2026-09-15' }),
  seedSubscription({ id: 'sub-rakesh-buffalo', customerId: 'customer-rakesh', productId: 'product-buffalo-milk', variantId: 'buf-500', schedule: { scheduleType: 'custom_weekdays', weekdays: [1, 3, 5], alternatePatternDate: null }, deliverySlotId: 'slot-morning', startDate: '2026-09-20' }),
  seedSubscription({ id: 'sub-meena-cow', customerId: 'customer-meena', productId: 'product-cow-milk', variantId: 'cow-500', schedule: { scheduleType: 'alternate_days', weekdays: [], alternatePatternDate: '2026-09-22' }, deliverySlotId: 'slot-morning', startDate: '2026-09-22' }),
  seedSubscription({ id: 'sub-anita-buffalo', customerId: 'customer-anita', productId: 'product-buffalo-milk', variantId: 'buf-500', schedule: { scheduleType: 'custom_weekdays', weekdays: [1, 3, 5], alternatePatternDate: null }, deliverySlotId: 'slot-evening', startDate: '2026-09-10', status: 'paused', pauses: [{ id: 'pause-anita-1', fromDate: '2026-10-05', resumeDate: null, reason: 'Travelling' }] }),
]

const readSubscriptions = () => readCollection<Subscription[]>(SUBSCRIPTIONS_KEY, seedSubscriptions)
const readExceptions = () => readCollection<SubscriptionDeliveryException[]>(EXCEPTIONS_KEY, [])

export const subscriptionRepository = {
  list: () => readSubscriptions(),
  get: (id: string) => readSubscriptions().find(item => item.id === id),
  listByCustomer: (customerId: string) => readSubscriptions().filter(item => item.customerId === customerId),
  /** Subscriptions that are not cancelled, i.e. still hold or may resume deliveries. */
  countOpenByCustomer: (customerId: string) => readSubscriptions().filter(item => item.customerId === customerId && item.status !== 'cancelled').length,
  insert(record: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Subscription {
    const timestamp = now()
    const created: Subscription = { ...record, id: `sub-${crypto.randomUUID()}`, createdAt: timestamp, updatedAt: timestamp }
    writeCollection(SUBSCRIPTIONS_KEY, [...readSubscriptions(), created])
    return created
  },
  replace(id: string, changes: Partial<Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>>): Subscription | undefined {
    let updated: Subscription | undefined
    writeCollection(SUBSCRIPTIONS_KEY, readSubscriptions().map(item => item.id === id ? (updated = { ...item, ...changes, updatedAt: now() }) : item))
    return updated
  },
  listAllExceptions: () => readExceptions(),
  listExceptions: (subscriptionId: string) => readExceptions().filter(item => item.subscriptionId === subscriptionId),
  insertException(record: Omit<SubscriptionDeliveryException, 'id' | 'createdAt'>): SubscriptionDeliveryException {
    const created: SubscriptionDeliveryException = { ...record, id: `exception-${crypto.randomUUID()}`, createdAt: now() }
    writeCollection(EXCEPTIONS_KEY, [...readExceptions(), created])
    return created
  },
}
