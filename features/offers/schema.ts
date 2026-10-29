import { z } from 'zod'
import { windowError } from '@/lib/active-window'
import { paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'
import type { Offer, OfferInput } from './types'
import { t } from './messages'

// Messages are looked up when shown, so they follow the admin's language.
const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, { error: () => t('errDate') })
const wholeNumberOrEmpty = (label: 'planLength' | 'limit') => z.string().trim().refine(value => value === '' || /^[1-9]\d{0,6}$/.test(value), { error: () => t('errWhole', { label: t(label) }) })
const rupeesOrEmpty = z.string().trim().refine(value => value === '' || parseRupeesToPaise(value) !== null, { error: () => t('errAmount') })

/** Form values keep amounts and counts as text (rupees, percent, numbers); `toInput` converts them for the server, which checks everything again. */
export const offerSchema = z.object({
  title: z.string().trim().min(1, { error: () => t('errTitle') }).max(80, { error: () => t('errTitleLong') }),
  titleGu: z.string().trim().max(80, { error: () => t('errTitleLong') }),
  description: z.string().trim().max(300, { error: () => t('errDescriptionLong') }),
  descriptionGu: z.string().trim().max(300, { error: () => t('errDescriptionLong') }),
  kind: z.enum(['percent', 'flat', 'free_gift']),
  percent: z.string().trim(),
  flat: rupeesOrEmpty,
  maxDiscount: rupeesOrEmpty,
  minOrder: rupeesOrEmpty,
  scope: z.enum(['order', 'products']),
  productIds: z.array(z.string()).max(50, { error: () => t('errProductsMax') }),
  giftProductId: z.string(),
  giftVariantId: z.string(),
  giftQuantity: z.string().trim().refine(value => /^([1-9]|1\d|20)$/.test(value), { error: () => t('errGiftQuantity') }),
  appliesOneTime: z.boolean(), appliesTrial: z.boolean(), appliesSubscription: z.boolean(),
  minPlanDays: wholeNumberOrEmpty('planLength'),
  code: z.string().trim().toUpperCase().refine(value => value === '' || /^[A-Z0-9]{3,20}$/.test(value), { error: () => t('errCode') }),
  startsOn: isoDateOrEmpty, endsOn: isoDateOrEmpty,
  totalLimit: wholeNumberOrEmpty('limit'), perCustomerLimit: wholeNumberOrEmpty('limit'),
  status: z.enum(['active', 'inactive']),
}).superRefine((form, context) => {
  const problem = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
  if (form.kind === 'percent') {
    const percent = Number(form.percent)
    if (!/^\d{1,2}$/.test(form.percent) || percent < 1 || percent > 99) problem('percent', t('errPercent'))
  }
  if (form.kind === 'flat' && (parseRupeesToPaise(form.flat) ?? 0) <= 0) problem('flat', t('errFlat'))
  if (form.kind === 'free_gift') {
    if (!form.giftVariantId) problem('giftVariantId', t('errGiftVariant'))
    if (form.productIds.length === 0) problem('productIds', t('errGiftProducts'))
  }
  if (form.kind !== 'free_gift' && form.scope === 'products' && form.productIds.length === 0) problem('productIds', t('errProducts'))
  if (!form.appliesOneTime && !form.appliesTrial && !form.appliesSubscription) problem('appliesOneTime', t('errWhere'))
  if (form.minPlanDays && !form.appliesSubscription) problem('minPlanDays', t('errPlanOnlySubscriptions'))
  const range = windowError(form.startsOn, form.endsOn)
  if (range) problem('endsOn', range)
})
export type OfferFormValues = z.infer<typeof offerSchema>

export const blankOffer: OfferFormValues = {
  title: '', titleGu: '', description: '', descriptionGu: '', kind: 'percent', percent: '', flat: '', maxDiscount: '', minOrder: '', scope: 'order', productIds: [],
  giftProductId: '', giftVariantId: '', giftQuantity: '1', appliesOneTime: true, appliesTrial: false, appliesSubscription: false, minPlanDays: '', code: '',
  startsOn: '', endsOn: '', totalLimit: '', perCustomerLimit: '', status: 'active',
}

export function fromOffer(offer: Offer): OfferFormValues {
  return {
    title: offer.title, titleGu: offer.titleGu, description: offer.description, descriptionGu: offer.descriptionGu, kind: offer.kind,
    percent: offer.percent === null ? '' : String(offer.percent), flat: offer.flatPaise === null ? '' : paiseToRupeeInput(offer.flatPaise),
    maxDiscount: offer.maxDiscountPaise === null ? '' : paiseToRupeeInput(offer.maxDiscountPaise), minOrder: offer.minOrderPaise ? paiseToRupeeInput(offer.minOrderPaise) : '',
    scope: offer.scope, productIds: offer.productIds, giftProductId: offer.giftProductId ?? '', giftVariantId: offer.giftVariantId ?? '', giftQuantity: String(offer.giftQuantity),
    appliesOneTime: offer.appliesOneTime, appliesTrial: offer.appliesTrial, appliesSubscription: offer.appliesSubscription, minPlanDays: offer.minPlanDays === null ? '' : String(offer.minPlanDays),
    code: offer.code ?? '', startsOn: offer.startsOn ?? '', endsOn: offer.endsOn ?? '', totalLimit: offer.totalLimit === null ? '' : String(offer.totalLimit),
    perCustomerLimit: offer.perCustomerLimit === null ? '' : String(offer.perCustomerLimit), status: offer.status,
  }
}

const orNull = (value: string): number | null => (value === '' ? null : Number(value))

export function toInput(form: OfferFormValues): OfferInput {
  const isGift = form.kind === 'free_gift'
  return {
    title: form.title, titleGu: form.titleGu, description: form.description, descriptionGu: form.descriptionGu, kind: form.kind,
    percent: form.kind === 'percent' ? Number(form.percent) : null,
    flatPaise: form.kind === 'flat' ? parseRupeesToPaise(form.flat) : null,
    maxDiscountPaise: form.kind === 'percent' && form.maxDiscount ? parseRupeesToPaise(form.maxDiscount) : null,
    minOrderPaise: form.minOrder ? (parseRupeesToPaise(form.minOrder) ?? 0) : 0,
    // A gift is always earned by chosen products; money-off offers count the whole cart unless products are chosen.
    scope: isGift ? 'products' : form.scope,
    productIds: isGift || form.scope === 'products' ? form.productIds : [],
    appliesOneTime: form.appliesOneTime, appliesTrial: form.appliesTrial, appliesSubscription: form.appliesSubscription,
    minPlanDays: form.appliesSubscription ? orNull(form.minPlanDays) : null,
    giftVariantId: isGift ? form.giftVariantId : null, giftQuantity: isGift ? Number(form.giftQuantity) : 1,
    code: form.code === '' ? null : form.code,
    startsOn: form.startsOn || null, endsOn: form.endsOn || null,
    totalLimit: orNull(form.totalLimit), perCustomerLimit: orNull(form.perCustomerLimit), status: form.status,
  }
}
