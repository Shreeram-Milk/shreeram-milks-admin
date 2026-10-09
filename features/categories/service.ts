import { productRepository } from '../products/mock-repository'
import { categoryRepository } from './mock-repository'
import type { Category, CategoryInput, CategoryStatus } from './types'

export class CategoryRuleError extends Error {}

const sorted = (categories: Category[]) => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const categoryService = {
  list: () => sorted(categoryRepository.list()),
  listActive: () => sorted(categoryRepository.list().filter(item => item.status === 'active')),
  getById: (id: string) => categoryRepository.get(id),
  /** One query's worth of product counts, keyed by category id. */
  productCounts(): Map<string, number> {
    const counts = new Map<string, number>()
    for (const product of productRepository.list()) counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1)
    return counts
  },
  name: (id: string) => categoryRepository.get(id)?.name ?? '',
  /** Active categories for a picker; keeps a product's current category selectable even if it was later deactivated. */
  options(currentId = ''): Array<{ value: string; label: string }> {
    return sorted(categoryRepository.list().filter(item => item.status === 'active' || item.id === currentId)).map(item => ({ value: item.id, label: item.status === 'active' ? item.name : `${item.name} (inactive)` }))
  },
  save(input: CategoryInput): Category {
    const name = input.name.trim()
    if (!name) throw new CategoryRuleError('Enter a category name.')
    if (categoryRepository.list().some(item => item.id !== input.id && sameName(item.name, name))) throw new CategoryRuleError(`A category named "${name}" already exists.`)
    return categoryRepository.save({ ...input, name, nameGujarati: input.nameGujarati.trim(), description: input.description.trim() })
  },
  dependencies(id: string): string[] {
    const count = productRepository.list().filter(product => product.categoryId === id).length
    return count ? [`${count} ${count === 1 ? 'product' : 'products'}`] : []
  },
  setStatus(id: string, status: CategoryStatus) {
    if (!categoryRepository.get(id)) throw new CategoryRuleError('Category not found.')
    categoryRepository.setStatus(id, status)
  },
}
