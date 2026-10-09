import { readCollection, writeCollection } from './mock-storage'

export type MockRecord = { id: string; updatedAt: string }
export type MockInput<T extends MockRecord> = Omit<T, 'id' | 'updatedAt'> & { id?: string }

/**
 * Browser-backed collection for the frontend-only phase. A feature repository wraps one of these; replacing it
 * with API calls (one table per collection) must not touch services or UI.
 */
export function createMockCollection<T extends MockRecord>(key: string, seed: T[], idPrefix: string) {
  const read = () => readCollection<T[]>(key, seed)
  return {
    list: read,
    get: (id: string) => read().find(item => item.id === id),
    save(input: MockInput<T>): T {
      const items = read()
      const record = { ...input, id: input.id ?? `${idPrefix}-${crypto.randomUUID()}`, updatedAt: new Date().toISOString() } as T
      writeCollection(key, input.id ? items.map(item => item.id === input.id ? record : item) : [...items, record])
      return record
    },
    patch(id: string, changes: Partial<Omit<T, 'id' | 'updatedAt'>>) {
      writeCollection(key, read().map(item => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item))
    },
  }
}
