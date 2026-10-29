import { z } from 'zod'
import type { ProductPayload, Product, ProductStatus } from './api'
import { MAX_GALLERY_IMAGES, MAX_HIGHLIGHT_LENGTH, MAX_HIGHLIGHTS } from './types'
import { t, type ProductKey } from './messages'

/** A check message looked up when the check runs, so it is in the admin's current language. */
const say = (key: ProductKey, vars?: Record<string, number>) => ({ error: () => t(key, vars) })

const variantSchema = z.object({
  /** Only for the form's own list keys; never sent. */
  clientKey: z.string(),
  /** The saved variant's id; empty for one that has not been saved yet. */
  id: z.string().optional(),
  name: z.string().trim().min(1, say('vVariantName')), sku: z.string(),
  pricePaise: z.number().int().min(1, say('vPrice')), compareAtPricePaise: z.number().int().nullable(),
  status: z.enum(['active', 'inactive']), displayUnit: z.string().min(1, say('vDisplayUnit')),
  displayQuantity: z.number().positive(say('vDisplayQuantity')), productionUnit: z.string(), productionQuantity: z.number().nonnegative(),
}).refine(variant => variant.compareAtPricePaise === null || variant.compareAtPricePaise > variant.pricePaise, { path: ['compareAtPricePaise'], ...say('vOldPrice') })
const highlightLines = z.array(z.string().max(MAX_HIGHLIGHT_LENGTH, say('vHighlightLength', { limit: MAX_HIGHLIGHT_LENGTH }))).refine(lines => lines.filter(line => line.trim()).length <= MAX_HIGHLIGHTS, say('vHighlightCount', { max: MAX_HIGHLIGHTS }))
const contentSchema = z.object({
  longDescriptionEn: z.string().max(2000, say('vDescription')), longDescriptionGu: z.string().max(2000, say('vDescription')),
  primaryImageAssetId: z.string(), galleryAssetIds: z.array(z.string()).max(MAX_GALLERY_IMAGES, say('vGallery', { max: MAX_GALLERY_IMAGES })),
  nutritionEn: z.string().max(1000, say('vNutrition')), nutritionGu: z.string().max(1000, say('vNutrition')),
  highlightsEn: highlightLines, highlightsGu: highlightLines, badges: z.array(z.enum(['bestseller', 'new', 'seasonal'])),
})

/**
 * Quick checks so staff see a mistake before the round trip. The server checks everything again and is the only authority.
 */
export const productSchema = z.object({
  name: z.string().trim().min(1, say('vName')), nameGu: z.string().trim().max(80, say('vNameGu')), categoryId: z.string().min(1, say('vCategory')),
  sku: z.string(), shortDescriptionEn: z.string().max(200, say('vShort')), shortDescriptionGu: z.string().max(200, say('vShort')), content: contentSchema,
  status: z.enum(['draft', 'active', 'inactive']), variants: z.array(variantSchema), purchaseMethods: z.array(z.enum(['buy_once', 'trial', 'subscription'])),
  trialPlanIds: z.array(z.string()), subscriptionRuleIds: z.array(z.string()),
  deliveryMethod: z.enum(['', 'local_delivery', 'shipping']), serviceAreaId: z.string(), cutoffRuleId: z.string(), includeInProductionPlanning: z.boolean(), excludedFromCredit: z.boolean(),
}).superRefine((value, context) => {
  const names = value.variants.map(variant => variant.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) context.addIssue({ code: 'custom', path: ['variants'], message: t('vUniqueVariants') })
  if (value.deliveryMethod === 'shipping' && (value.cutoffRuleId || value.includeInProductionPlanning)) context.addIssue({ code: 'custom', path: ['deliveryMethod'], message: t('vShippingNoCutoff') })
  if (value.status === 'draft') return
  if (!value.variants.some(variant => variant.status === 'active')) context.addIssue({ code: 'custom', path: ['variants'], message: t('vActiveVariant') })
  if (!value.purchaseMethods.length) context.addIssue({ code: 'custom', path: ['purchaseMethods'], message: t('vMethod') })
  if (value.deliveryMethod === 'shipping' && value.purchaseMethods.some(method => method !== 'buy_once')) context.addIssue({ code: 'custom', path: ['purchaseMethods'], message: t('vCourierBuyOnce') })
  if (!value.deliveryMethod) context.addIssue({ code: 'custom', path: ['deliveryMethod'], message: t('vDeliveryMethod') })
  if (!value.serviceAreaId) context.addIssue({ code: 'custom', path: ['serviceAreaId'], message: t('vArea') })
  if (value.purchaseMethods.includes('trial') && value.trialPlanIds.length === 0) context.addIssue({ code: 'custom', path: ['trialPlanIds'], message: t('vTrialPlan') })
  if (value.purchaseMethods.includes('subscription') && value.subscriptionRuleIds.length === 0) context.addIssue({ code: 'custom', path: ['subscriptionRuleIds'], message: t('vSchedule') })
})
export type ProductFormValues = z.infer<typeof productSchema>
export type FormVariant = ProductFormValues['variants'][number]

export const newVariant = (): FormVariant => ({ clientKey: crypto.randomUUID(), name: '', sku: '', pricePaise: 0, compareAtPricePaise: null, status: 'active', displayUnit: '', displayQuantity: 1, productionUnit: '', productionQuantity: 0 })

export function emptyForm(): ProductFormValues {
  return {
    name: '', nameGu: '', categoryId: '', sku: '', shortDescriptionEn: '', shortDescriptionGu: '',
    content: { longDescriptionEn: '', longDescriptionGu: '', primaryImageAssetId: '', galleryAssetIds: [], nutritionEn: '', nutritionGu: '', highlightsEn: [], highlightsGu: [], badges: [] },
    status: 'draft', variants: [], purchaseMethods: [], trialPlanIds: [], subscriptionRuleIds: [],
    deliveryMethod: '', serviceAreaId: '', cutoffRuleId: '', includeInProductionPlanning: false, excludedFromCredit: false,
  }
}

export function toForm(product: Product): ProductFormValues {
  return {
    name: product.name, nameGu: product.nameGu, categoryId: product.categoryId, sku: product.sku, shortDescriptionEn: product.shortDescriptionEn, shortDescriptionGu: product.shortDescriptionGu,
    content: {
      longDescriptionEn: product.longDescriptionEn, longDescriptionGu: product.longDescriptionGu, nutritionEn: product.nutritionEn, nutritionGu: product.nutritionGu,
      highlightsEn: product.highlightsEn, highlightsGu: product.highlightsGu, badges: product.badges, primaryImageAssetId: product.primaryImage?.assetId ?? '', galleryAssetIds: product.gallery.map(image => image.assetId),
    },
    status: product.status, purchaseMethods: product.purchaseMethods, trialPlanIds: product.trialPlanIds, subscriptionRuleIds: product.subscriptionRuleIds,
    deliveryMethod: product.deliveryMethod ?? '', serviceAreaId: product.serviceAreaId ?? '', cutoffRuleId: product.cutoffRuleId ?? '', includeInProductionPlanning: product.includeInProductionPlanning, excludedFromCredit: product.excludedFromCredit,
    variants: product.variants.map(variant => ({ ...variant, clientKey: variant.id })),
  }
}

/** The values the form is allowed to save as: a product that has been published can be switched off but never made a draft again. */
export const statusChoices = (existing: ProductStatus | undefined): ProductStatus[] => (existing && existing !== 'draft' ? ['active', 'inactive'] : ['draft', 'active'])

const lines = (items: string[]) => [...new Set(items.map(line => line.trim()).filter(Boolean))]

export function toPayload(values: ProductFormValues): ProductPayload {
  const { content } = values
  return {
    name: values.name.trim(), nameGu: values.nameGu.trim(), categoryId: values.categoryId, sku: values.sku.trim(), shortDescriptionEn: values.shortDescriptionEn.trim(), shortDescriptionGu: values.shortDescriptionGu.trim(),
    longDescriptionEn: content.longDescriptionEn.trim(), longDescriptionGu: content.longDescriptionGu.trim(), nutritionEn: content.nutritionEn.trim(), nutritionGu: content.nutritionGu.trim(),
    highlightsEn: lines(content.highlightsEn), highlightsGu: lines(content.highlightsGu), badges: content.badges,
    primaryImageAssetId: content.primaryImageAssetId || null, galleryAssetIds: content.galleryAssetIds.filter(id => id !== content.primaryImageAssetId),
    purchaseMethods: values.purchaseMethods,
    deliveryMethod: values.deliveryMethod || null, serviceAreaId: values.serviceAreaId || null,
    cutoffRuleId: values.deliveryMethod === 'local_delivery' ? values.cutoffRuleId || null : null, includeInProductionPlanning: values.deliveryMethod === 'local_delivery' && Boolean(values.cutoffRuleId) && values.includeInProductionPlanning, excludedFromCredit: values.excludedFromCredit,
    trialPlanIds: values.purchaseMethods.includes('trial') ? values.trialPlanIds : [], subscriptionRuleIds: values.purchaseMethods.includes('subscription') ? values.subscriptionRuleIds : [],
    status: values.status,
    variants: values.variants.map(variant => ({
      ...(variant.id ? { id: variant.id } : {}), name: variant.name.trim(), sku: variant.sku.trim(), pricePaise: variant.pricePaise, compareAtPricePaise: variant.compareAtPricePaise, status: variant.status,
      displayUnit: variant.displayUnit.trim(), displayQuantity: variant.displayQuantity, productionUnit: variant.productionUnit.trim(), productionQuantity: variant.productionQuantity,
    })),
  }
}
