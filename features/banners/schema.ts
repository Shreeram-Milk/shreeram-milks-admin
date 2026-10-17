import { z } from 'zod'
import { windowError } from '@/lib/active-window'

const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')

/** Form rules for the banner dialog, for instant feedback. The backend checks the same rules again before saving. */
export const bannerSchema = z.object({
  type: z.enum(['promotion', 'warning', 'maintenance', 'informational']),
  audience: z.enum(['all_users', 'prepaid', 'credit', 'subscribers']),
  titleEn: z.string().trim().min(1, 'Enter a headline.').max(80, 'Keep the headline under 80 characters.'),
  titleGu: z.string().trim().max(80, 'Keep the headline under 80 characters.'),
  messageEn: z.string().trim().max(160, 'Keep the text under 160 characters.'),
  messageGu: z.string().trim().max(160, 'Keep the text under 160 characters.'),
  labelEn: z.string().trim().max(24, 'Keep the label under 24 characters.'),
  labelGu: z.string().trim().max(24, 'Keep the label under 24 characters.'),
  imageAssetId: z.string().nullable(),
  ctaType: z.enum(['none', 'product', 'category', 'offers']),
  ctaTarget: z.string(),
  startDate: isoDateOrEmpty,
  endDate: isoDateOrEmpty,
  sortOrder: z.number().int('Use a whole number.').min(0, 'Use zero or greater.').max(1000, 'Use 1000 or less.'),
  status: z.enum(['active', 'inactive']),
}).superRefine((value, context) => {
  if (value.type === 'warning' && value.imageAssetId) context.addIssue({ code: 'custom', path: ['imageAssetId'], message: 'Warnings are plain text. Remove the picture.' })
  if (value.ctaType !== 'none' && value.ctaType !== 'offers' && !value.ctaTarget) context.addIssue({ code: 'custom', path: ['ctaTarget'], message: `Choose the ${value.ctaType} this banner opens.` })
  const range = windowError(value.startDate, value.endDate)
  if (range) context.addIssue({ code: 'custom', path: ['endDate'], message: range })
})
export type BannerFormValues = z.infer<typeof bannerSchema>
