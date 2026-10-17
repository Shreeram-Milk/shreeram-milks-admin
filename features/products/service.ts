import { configurationService, fulfilmentProfileService, subscriptionRuleService, trialPlanService } from '../configuration/mock-store'
import { categoryService } from '../categories/service'
import { mediaService } from '../media/service'
import { productRepository } from './mock-repository'
import { MAX_GALLERY_IMAGES, MAX_HIGHLIGHT_LENGTH, MAX_HIGHLIGHTS, type ProductContent, type ProductInput, type ProductStatus } from './types'

/** Trims highlight lines, drops blanks and repeats, and checks that every chosen image exists in the library and is an image. */
export function normalizeContent(content: ProductContent): ProductContent {
  const lines = (items: string[]) => [...new Set(items.map(line => line.trim()).filter(Boolean))]
  const highlightsEn = lines(content.highlightsEn)
  const highlightsGu = lines(content.highlightsGu)
  if (highlightsEn.length > MAX_HIGHLIGHTS || highlightsGu.length > MAX_HIGHLIGHTS) throw new Error(`Add at most ${MAX_HIGHLIGHTS} highlights.`)
  if ([...highlightsEn, ...highlightsGu].some(line => line.length > MAX_HIGHLIGHT_LENGTH)) throw new Error(`Keep each highlight under ${MAX_HIGHLIGHT_LENGTH} characters.`)
  const galleryAssetIds = [...new Set(content.galleryAssetIds)].filter(id => id !== content.primaryImageAssetId)
  if (galleryAssetIds.length > MAX_GALLERY_IMAGES) throw new Error(`Add at most ${MAX_GALLERY_IMAGES} gallery images.`)
  for (const id of [content.primaryImageAssetId, ...galleryAssetIds].filter(Boolean)) {
    const asset = mediaService.getById(id)
    if (!asset) throw new Error('One of the chosen images is no longer in the Media Library.')
    if (asset.type !== 'image') throw new Error(`“${asset.displayName}” is a document. Product images must be images.`)
  }
  return { ...content, longDescriptionEn: content.longDescriptionEn.trim(), longDescriptionGu: content.longDescriptionGu.trim(), nutritionEn: content.nutritionEn.trim(), nutritionGu: content.nutritionGu.trim(), highlightsEn, highlightsGu, galleryAssetIds, badges: [...new Set(content.badges)] }
}

export const productService = {
  list: () => productRepository.list(),
  getById: (id: string) => productRepository.get(id),
  save(input: ProductInput) {
    const current = input.id ? productRepository.get(input.id) : undefined
    const category = categoryService.getById(input.categoryId)
    if (!category) throw new Error('Choose a category before saving.')
    if (category.status !== 'active' && category.id !== current?.categoryId) throw new Error('Choose an active category.')
    const product = productRepository.save({ ...input, content: normalizeContent(input.content),
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
