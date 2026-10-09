import { z } from 'zod'
import { windowError } from '@/lib/active-window'

const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')
const httpsUrlOrEmpty = z.string().trim().max(500).refine(value => value === '' || /^https:\/\/\S+$/.test(value), 'Use a full https:// link, or leave empty.')

export const bannerSchema = z.object({
  label: z.string().trim().max(30, 'Keep the label under 30 characters.'),
  title: z.string().trim().min(1, 'Enter a headline.').max(80, 'Keep the headline under 80 characters.'),
  titleGujarati: z.string().trim().max(80, 'Keep the headline under 80 characters.'),
  subtitle: z.string().trim().max(160, 'Keep the text under 160 characters.'),
  subtitleGujarati: z.string().trim().max(160, 'Keep the text under 160 characters.'),
  imageUrl: httpsUrlOrEmpty,
  linkType: z.enum(['none', 'product', 'category']),
  linkTargetId: z.string(),
  startDate: isoDateOrEmpty,
  endDate: isoDateOrEmpty,
  sortOrder: z.number().int('Use a whole number.').min(0, 'Use zero or greater.'),
  status: z.enum(['active', 'inactive']),
}).superRefine((value, context) => {
  if (value.linkType !== 'none' && !value.linkTargetId) context.addIssue({ code: 'custom', path: ['linkTargetId'], message: `Choose the ${value.linkType} this banner opens.` })
  const range = windowError(value.startDate, value.endDate)
  if (range) context.addIssue({ code: 'custom', path: ['endDate'], message: range })
})
export type BannerFormValues = z.infer<typeof bannerSchema>
