import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { readCollection, writeCollection } from '@/lib/mock-storage'
import { trialEndDate } from './generation'
import type { TrialEnrollment } from './types'

const KEY = 'shreeram-admin-trials-v1'
const now = () => new Date().toISOString()

/** One active starter trial (started yesterday) so the lifecycle is visible on first use. */
function seedTrials(): TrialEnrollment[] {
  const stamp = now()
  const startDate = addDays(todayInBusinessZone(), -1)
  return [{
    id: 'trial-seed-1', customerId: 'customer-anita', productId: 'product-buffalo-milk', variantId: 'buf-500', trialPlanId: 'trial-3-day', trialPlanNameSnapshot: '3-Day Trial', durationDaysSnapshot: 3,
    fulfilmentProfileId: 'profile-gandhinagar', deliverySlotId: 'slot-evening', quantity: 1, unitPricePaiseSnapshot: 4000, startDate, endDate: trialEndDate(startDate, 3),
    lifecycle: 'open', cancellation: null, convertedSubscriptionId: null, createdAt: stamp, updatedAt: stamp,
  }]
}

const read = () => readCollection<TrialEnrollment[]>(KEY, seedTrials())
const write = (rows: TrialEnrollment[]) => writeCollection(KEY, rows)

export const trialRepository = {
  list: () => read(),
  get: (id: string) => read().find(trial => trial.id === id),
  listForCustomer: (customerId: string) => read().filter(trial => trial.customerId === customerId),
  insert(trial: Omit<TrialEnrollment, 'id' | 'createdAt' | 'updatedAt'>): TrialEnrollment {
    const stamp = now()
    const created: TrialEnrollment = { ...trial, id: `trial-${crypto.randomUUID()}`, createdAt: stamp, updatedAt: stamp }
    write([...read(), created])
    return created
  },
  replace(id: string, changes: Partial<Omit<TrialEnrollment, 'id' | 'createdAt' | 'updatedAt'>>): TrialEnrollment | undefined {
    let updated: TrialEnrollment | undefined
    write(read().map(trial => trial.id === id ? (updated = { ...trial, ...changes, updatedAt: now() }) : trial))
    return updated
  },
}
