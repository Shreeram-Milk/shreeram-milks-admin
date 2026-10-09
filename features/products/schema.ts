import { z } from 'zod'

const variantSchema = z.object({
  id: z.string(), name: z.string().trim().min(1, 'Variant name is required.'), sku: z.string(),
  pricePaise: z.number().int().min(0, 'Price must be zero or greater.'), compareAtPricePaise: z.number().int().optional(),
  status: z.enum(['active', 'inactive']), displayUnit: z.string().min(1, 'Display unit is required.'),
  displayQuantity: z.number().positive('Display quantity must be greater than zero.'), productionUnit: z.string(), productionQuantity: z.number().nonnegative(),
})
export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'), nameGujarati: z.string().trim().max(80, 'Keep the Gujarati name under 80 characters.'), categoryId: z.string().min(1, 'Choose a category.'),
  sku: z.string(), shortDescription: z.string(), shortDescriptionGujarati: z.string(), imageUrl: z.string(), status: z.enum(['draft', 'active', 'inactive']),
  variants: z.array(variantSchema), purchaseMethods: z.array(z.enum(['buy_once', 'trial', 'subscription'])),
  trialPlanIds: z.array(z.string()), subscriptionRuleIds: z.array(z.string()), fulfilmentProfileId: z.string(),
}).superRefine((value, context) => {
  if (value.status !== 'draft') {
    if (!value.variants.length) context.addIssue({ code: 'custom', path: ['variants'], message: 'Add at least one variant before publishing.' })
    if (!value.purchaseMethods.length) context.addIssue({ code: 'custom', path: ['purchaseMethods'], message: 'Select at least one purchase method.' })
    if (!value.fulfilmentProfileId) context.addIssue({ code: 'custom', path: ['fulfilmentProfileId'], message: 'Select a fulfilment profile.' })
  }
  if (value.status !== 'draft' && value.purchaseMethods.includes('trial') && value.trialPlanIds.length === 0) context.addIssue({ code: 'custom', path: ['trialPlanIds'], message: 'Select at least one trial plan.' })
  if (value.status !== 'draft' && value.purchaseMethods.includes('subscription') && value.subscriptionRuleIds.length === 0) context.addIssue({ code: 'custom', path: ['subscriptionRuleIds'], message: 'Select at least one subscription schedule.' })
  const names = value.variants.map(variant => variant.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) context.addIssue({ code: 'custom', path: ['variants'], message: 'Variant names must be unique.' })
})
export type ProductFormValues = z.infer<typeof productSchema>
