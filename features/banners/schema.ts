import { z } from 'zod'
import { windowError } from '@/lib/active-window'
import { t } from './messages'
import { CTA_WITH_TARGET } from './types'

// Messages are looked up when shown, so they follow the admin's language.
const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, { error: () => t('errDate') })

/** Form rules for the banner dialog, for instant feedback. The backend checks the same rules again before saving. */
export const bannerSchema = z.object({
  type: z.enum(['promotion', 'warning', 'maintenance', 'informational']),
  audience: z.enum(['all_users', 'prepaid', 'credit', 'subscribers']),
  titleEn: z.string().trim().min(1, { error: () => t('errHeadline') }).max(80, { error: () => t('errHeadlineLong') }),
  titleGu: z.string().trim().max(80, { error: () => t('errHeadlineLong') }),
  messageEn: z.string().trim().max(160, { error: () => t('errTextLong') }),
  messageGu: z.string().trim().max(160, { error: () => t('errTextLong') }),
  labelEn: z.string().trim().max(24, { error: () => t('errLabelLong') }),
  labelGu: z.string().trim().max(24, { error: () => t('errLabelLong') }),
  imageAssetId: z.string().nullable(),
  showText: z.boolean(),
  ctaType: z.enum(['none', 'product', 'category', 'offers', 'offer', 'subscriptions', 'trials', 'orders', 'rewards']),
  ctaTarget: z.string(),
  startDate: isoDateOrEmpty,
  endDate: isoDateOrEmpty,
  sortOrder: z.number().int({ error: () => t('errWhole') }).min(0, { error: () => t('errNonNegative') }).max(1000, { error: () => t('errMax') }),
  status: z.enum(['active', 'inactive']),
}).superRefine((value, context) => {
  if (value.type === 'warning' && value.imageAssetId) context.addIssue({ code: 'custom', path: ['imageAssetId'], message: t('errWarningPicture') })
  if (CTA_WITH_TARGET.includes(value.ctaType) && !value.ctaTarget) context.addIssue({ code: 'custom', path: ['ctaTarget'], message: t(value.ctaType === 'product' ? 'errChooseProduct' : value.ctaType === 'offer' ? 'errChooseOffer' : 'errChooseCategory') })
  if (value.type === 'promotion' && !value.showText && !value.imageAssetId) context.addIssue({ code: 'custom', path: ['showText'], message: t('errTextOffNeedsPicture') })
  const range = windowError(value.startDate, value.endDate)
  if (range) context.addIssue({ code: 'custom', path: ['endDate'], message: range })
})
export type BannerFormValues = z.infer<typeof bannerSchema>
