import { readCollection, writeCollection } from './mock-storage'

export type MockRecord = { id: string; updatedAt: string; createdAt?: string }
/** `createdAt` is optional on input: collections that track it keep the existing value on update and stamp it on create. */
export type MockInput<T extends MockRecord> = Omit<T, 'id' | 'updatedAt' | 'createdAt'> & { id?: string; createdAt?: string }

/**
 * Browser-backed collection for the frontend-only phase. A feature repository wraps one of these; replacing it
 * with API calls (one table per collection) must not touch services or UI.
 */
export function createMockCollection<T extends MockRecord>(key: string, seed: T[], idPrefix: string, { tracksCreatedAt = false, migrate }: { tracksCreatedAt?: boolean; migrate?: (stored: Record<string, unknown>) => T } = {}) {
  const read = () => { const items = readCollection<T[]>(key, seed); return migrate ? items.map(item => migrate(item as unknown as Record<string, unknown>)) : items }
  return {
    list: read,
    get: (id: string) => read().find(item => item.id === id),
    save(input: MockInput<T>): T {
      const items = read()
      const now = new Date().toISOString()
      const record = { ...input, id: input.id ?? `${idPrefix}-${crypto.randomUUID()}`, updatedAt: now, ...(tracksCreatedAt ? { createdAt: input.createdAt ?? now } : {}) } as unknown as T
      writeCollection(key, input.id ? items.map(item => item.id === input.id ? record : item) : [...items, record])
      return record
    },
    remove(id: string) {
      writeCollection(key, read().filter(item => item.id !== id))
    },
    patch(id: string, changes: Partial<Omit<T, 'id' | 'updatedAt' | 'createdAt'>>) {
      writeCollection(key, read().map(item => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item))
    },
  }
}
