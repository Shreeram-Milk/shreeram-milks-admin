import { configurationService, fulfilmentProfileService, subscriptionRuleService, trialPlanService } from '../configuration/mock-store'
import { categoryService } from '../categories/service'
import { productRepository } from './mock-repository'
import type { ProductInput, ProductStatus } from './types'

export const productService = {
  list: () => productRepository.list(),
  getById: (id: string) => productRepository.get(id),
  save(input: ProductInput) {
    const current = input.id ? productRepository.get(input.id) : undefined
    const category = categoryService.getById(input.categoryId)
    if (!category) throw new Error('Choose a category before saving.')
    if (category.status !== 'active' && category.id !== current?.categoryId) throw new Error('Choose an active category.')
    const product = productRepository.save({ ...input,
      trialPlanIds: input.purchaseMethods.includes('trial') ? input.trialPlanIds : [],
      subscriptionRuleIds: input.purchaseMethods.includes('subscription') ? input.subscriptionRuleIds : [],
    })
    syncConfigurationReferences()
    return product
  },
  setStatus(id: string, status: ProductStatus) { productRepository.setStatus(id, status); syncConfigurationReferences() },
  references() { return { trialPlans: trialPlanService.list(), subscriptionRules: subscriptionRuleService.list(), fulfilmentProfiles: fulfilmentProfileService.list() } },
  dependencies(id: string) { const product = productRepository.get(id); return product ? [`${product.purchaseMethods.includes('subscription') ? '1' : '0'} subscription configuration`, 'Historical orders and deliveries remain unchanged'] : [] },
}

function syncConfigurationReferences() {
  const products = productRepository.list()
  configurationService.setProductReferences({
    trialPlanIds: products.flatMap(product => product.trialPlanIds),
    subscriptionRuleIds: products.flatMap(product => product.subscriptionRuleIds),
    fulfilmentProfileIds: products.map(product => product.fulfilmentProfileId).filter(Boolean),
  })
}
