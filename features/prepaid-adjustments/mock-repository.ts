import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { PrepaidAdjustment } from './types'

const KEY = 'shreeram-admin-prepaid-adjustments-v1'
const now = () => new Date().toISOString()

const read = () => readCollection<PrepaidAdjustment[]>(KEY, [])

export const prepaidAdjustmentRepository = {
  list: () => read(),
  get: (id: string) => read().find(item => item.id === id),
  listForCustomer: (customerId: string) => read().filter(item => item.customerId === customerId),
  findByDedupeKey: (dedupeKey: string) => read().find(item => item.dedupeKey === dedupeKey),
  /** Appends adjustments; one whose dedupe key already exists is ignored, which is what makes events idempotent. */
  append(entries: Omit<PrepaidAdjustment, 'createdAt' | 'updatedAt'>[]): PrepaidAdjustment[] {
    const rows = read()
    const known = new Set(rows.map(row => row.dedupeKey))
    const stamp = now()
    const added: PrepaidAdjustment[] = []
    for (const entry of entries) {
      if (known.has(entry.dedupeKey)) continue
      known.add(entry.dedupeKey)
      added.push({ ...entry, createdAt: stamp, updatedAt: stamp })
    }
    if (added.length) writeCollection(KEY, [...rows, ...added])
    return added
  },
  setStatus(id: string, status: PrepaidAdjustment['status'], reason?: string): PrepaidAdjustment | undefined {
    let updated: PrepaidAdjustment | undefined
    writeCollection(KEY, read().map(item => item.id === id ? (updated = { ...item, status, reason: reason ?? item.reason, updatedAt: now() }) : item))
    return updated
  },
}
