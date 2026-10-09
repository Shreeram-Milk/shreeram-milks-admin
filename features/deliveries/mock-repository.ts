import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { IsoDate } from '@/lib/business-time'
import type { DeliveryInstance } from './types'

const KEY = 'shreeram-admin-deliveries-v1'
const BOOTSTRAP_KEY = 'shreeram-admin-deliveries-bootstrap-v1'
const now = () => new Date().toISOString()

const read = () => readCollection<DeliveryInstance[]>(KEY, [])
const write = (rows: DeliveryInstance[]) => writeCollection(KEY, rows)

export const deliveryRepository = {
  list: () => read(),
  get: (id: string) => read().find(item => item.id === id),
  /** Date-bounded read so callers never pull the whole history for a single day. */
  listBetween: (from: IsoDate, to: IsoDate) => read().filter(item => item.deliveryDate >= from && item.deliveryDate <= to),
  listForDate: (date: IsoDate) => read().filter(item => item.deliveryDate === date),
  listForSubscription: (subscriptionId: string) => read().filter(item => item.subscriptionId === subscriptionId),
  listForOrder: (orderId: string) => read().filter(item => item.orderId === orderId),
  listForTrial: (trialEnrollmentId: string) => read().filter(item => item.trialEnrollmentId === trialEnrollmentId),
  listForCustomer: (customerId: string) => read().filter(item => item.customerId === customerId),
  /** One write for a whole batch; inserts that would collide with an existing id are ignored. */
  apply(inserts: DeliveryInstance[], updates: Array<{ id: string; patch: Partial<DeliveryInstance> }>): void {
    if (!inserts.length && !updates.length) return
    const rows = read()
    const known = new Set(rows.map(row => row.id))
    const patches = new Map(updates.map(update => [update.id, update.patch]))
    const stamp = now()
    const next = rows.map(row => patches.has(row.id) ? { ...row, ...patches.get(row.id), updatedAt: stamp } : row)
    for (const insert of inserts) { if (!known.has(insert.id)) { known.add(insert.id); next.push(insert) } }
    write(next)
  },
  isBootstrapped: () => readCollection<boolean>(BOOTSTRAP_KEY, false),
  markBootstrapped: () => writeCollection(BOOTSTRAP_KEY, true),
}
