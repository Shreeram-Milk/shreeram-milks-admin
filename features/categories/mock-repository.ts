import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { Category, CategoryInput, CategoryStatus } from './types'

const KEY = 'shreeram-admin-categories-v1'
const now = () => new Date().toISOString()
const category = (id: string, name: string, nameGujarati: string, sortOrder: number): Category => ({ id, name, nameGujarati, description: '', sortOrder, status: 'active', updatedAt: '2026-01-01T00:00:00.000Z' })

/** Ids are stable slugs so products stored before categories existed can be matched by name. */
export const categorySeed: Category[] = [
  category('category-milk', 'Milk', 'દૂધ', 1),
  category('category-curd', 'Curd', 'દહીં', 2),
  category('category-paneer', 'Paneer', 'પનીર', 3),
  category('category-ghee', 'Ghee', 'ઘી', 4),
  category('category-butter', 'Butter', 'માખણ', 5),
]

const read = () => readCollection<Category[]>(KEY, categorySeed)

export const categoryRepository = {
  list: () => read(),
  get: (id: string) => read().find(item => item.id === id),
  save(input: CategoryInput): Category {
    const categories = read()
    const record: Category = { ...input, id: input.id ?? `category-${crypto.randomUUID()}`, updatedAt: now() }
    writeCollection(KEY, input.id ? categories.map(item => item.id === input.id ? record : item) : [...categories, record])
    return record
  },
  setStatus(id: string, status: CategoryStatus) {
    writeCollection(KEY, read().map(item => item.id === id ? { ...item, status, updatedAt: now() } : item))
  },
}
