import { z } from 'zod'
import { t } from './messages'

// Messages are looked up when shown, so they follow the admin's language.
export const slideSchema = z.object({
  imageAssetId: z.string().min(1, { error: () => t('errImage') }),
  titleEn: z.string().trim().min(1, { error: () => t('errHeadline') }).max(80, { error: () => t('errHeadlineLong') }),
  titleGu: z.string().trim().max(80, { error: () => t('errHeadlineLong') }),
  descriptionEn: z.string().trim().min(1, { error: () => t('errText') }).max(200, { error: () => t('errTextLong') }),
  descriptionGu: z.string().trim().max(200, { error: () => t('errTextLong') }),
  status: z.enum(['active', 'inactive']),
})
export type SlideFormValues = z.infer<typeof slideSchema>
