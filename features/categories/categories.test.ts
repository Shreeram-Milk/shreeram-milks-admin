import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { productService } from '../products/service'
import { categoryService, CategoryRuleError } from './service'

declare const __resetStorage: () => void

beforeEach(() => __resetStorage())

describe('categories', () => {
  it('rejects a duplicate name regardless of case or spacing', () => {
    assert.throws(() => categoryService.save({ name: '  milk ', nameGujarati: '', description: '', sortOrder: 9, status: 'active' }), CategoryRuleError)
  })
  it('counts the products linked to each category', () => {
    assert.equal(categoryService.productCounts().get('category-milk'), 2)
    assert.deepEqual(categoryService.dependencies('category-milk'), ['2 products'])
    assert.deepEqual(categoryService.dependencies('category-butter'), [])
  })
  it('only offers active categories, but keeps a product’s own inactive category selectable', () => {
    categoryService.setStatus('category-curd', 'inactive')
    assert.ok(!categoryService.options().some(option => option.value === 'category-curd'))
    assert.ok(categoryService.options('category-curd').some(option => option.value === 'category-curd'))
  })
  it('stops a product being saved into a missing or newly inactive category', () => {
    const cow = productService.getById('product-cow-milk')
    assert.ok(cow)
    assert.throws(() => productService.save({ ...cow, categoryId: 'category-missing' }), /category/i)
    categoryService.setStatus('category-curd', 'inactive')
    assert.throws(() => productService.save({ ...cow, categoryId: 'category-curd' }), /active category/i)
    categoryService.setStatus('category-milk', 'inactive')
    assert.doesNotThrow(() => productService.save({ ...cow, name: 'Fresh Cow Milk A2' }))
  })
})
