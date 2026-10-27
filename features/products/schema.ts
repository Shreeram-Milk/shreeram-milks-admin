import { z } from 'zod'
import type { ProductPayload, Product, ProductStatus } from './api'
import { MAX_GALLERY_IMAGES, MAX_HIGHLIGHT_LENGTH, MAX_HIGHLIGHTS } from './types'

const variantSchema = z.object({
  /** Only for the form's own list keys; never sent. */
  clientKey: z.string(),
  /** The saved variant's id; empty for one that has not been saved yet. */
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Variant name is required.'), sku: z.string(),
  pricePaise: z.number().int().min(1, 'Price must be greater than zero.'), compareAtPricePaise: z.number().int().nullable(),
  status: z.enum(['active', 'inactive']), displayUnit: z.string().min(1, 'Display unit is required.'),
  displayQuantity: z.number().positive('Display quantity must be greater than zero.'), productionUnit: z.string(), productionQuantity: z.number().nonnegative(),
}).refine(variant => variant.compareAtPricePaise === null || variant.compareAtPricePaise > variant.pricePaise, { path: ['compareAtPricePaise'], message: 'The old price must be higher than the price.' })
const highlightLines = z.array(z.string().max(MAX_HIGHLIGHT_LENGTH, `Keep each highlight under ${MAX_HIGHLIGHT_LENGTH} characters.`)).refine(lines => lines.filter(line => line.trim()).length <= MAX_HIGHLIGHTS, `Add at most ${MAX_HIGHLIGHTS} highlights.`)
const contentSchema = z.object({
  longDescriptionEn: z.string().max(2000, 'Keep the description under 2000 characters.'), longDescriptionGu: z.string().max(2000, 'Keep the description under 2000 characters.'),
  primaryImageAssetId: z.string(), galleryAssetIds: z.array(z.string()).max(MAX_GALLERY_IMAGES, `Add at most ${MAX_GALLERY_IMAGES} gallery images.`),
  nutritionEn: z.string().max(1000, 'Keep the nutrition information under 1000 characters.'), nutritionGu: z.string().max(1000, 'Keep the nutrition information under 1000 characters.'),
  highlightsEn: highlightLines, highlightsGu: highlightLines, badges: z.array(z.enum(['bestseller', 'new', 'seasonal'])),
})

/**
 * Quick checks so staff see a mistake before the round trip. The server checks everything again and is the only authority.
 */
export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'), nameGu: z.string().trim().max(80, 'Keep the Gujarati name under 80 characters.'), categoryId: z.string().min(1, 'Choose a category.'),
  sku: z.string(), shortDescriptionEn: z.string().max(200, 'Keep it under 200 characters.'), shortDescriptionGu: z.string().max(200, 'Keep it under 200 characters.'), content: contentSchema,
  status: z.enum(['draft', 'active', 'inactive']), variants: z.array(variantSchema), purchaseMethods: z.array(z.enum(['buy_once', 'trial', 'subscription'])),
  trialPlanIds: z.array(z.string()), subscriptionRuleIds: z.array(z.string()),
  deliveryMethod: z.enum(['', 'local_delivery', 'shipping']), serviceAreaId: z.string(), cutoffRuleId: z.string(), includeInProductionPlanning: z.boolean(), excludedFromCredit: z.boolean(),
}).superRefine((value, context) => {
  const names = value.variants.map(variant => variant.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) context.addIssue({ code: 'custom', path: ['variants'], message: 'Variant names must be unique.' })
  if (value.deliveryMethod === 'shipping' && (value.cutoffRuleId || value.includeInProductionPlanning)) context.addIssue({ code: 'custom', path: ['deliveryMethod'], message: 'Shipping cannot use a cut-off rule or production planning.' })
  if (value.status === 'draft') return
  if (!value.variants.some(variant => variant.status === 'active')) context.addIssue({ code: 'custom', path: ['variants'], message: 'Add at least one active variant before publishing.' })
  if (!value.purchaseMethods.length) context.addIssue({ code: 'custom', path: ['purchaseMethods'], message: 'Select at least one purchase method.' })
  if (value.deliveryMethod === 'shipping' && value.purchaseMethods.some(method => method !== 'buy_once')) context.addIssue({ code: 'custom', path: ['purchaseMethods'], message: 'Courier products can only be bought once (no trial or subscription).' })
  if (!value.deliveryMethod) context.addIssue({ code: 'custom', path: ['deliveryMethod'], message: 'Choose how this product is delivered.' })
  if (!value.serviceAreaId) context.addIssue({ code: 'custom', path: ['serviceAreaId'], message: 'Choose a delivery area.' })
  if (value.purchaseMethods.includes('trial') && value.trialPlanIds.length === 0) context.addIssue({ code: 'custom', path: ['trialPlanIds'], message: 'Select at least one trial plan.' })
  if (value.purchaseMethods.includes('subscription') && value.subscriptionRuleIds.length === 0) context.addIssue({ code: 'custom', path: ['subscriptionRuleIds'], message: 'Select at least one subscription schedule.' })
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
