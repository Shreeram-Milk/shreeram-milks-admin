import { z } from 'zod'
import { t } from './messages'

// Messages are looked up when shown, so they follow the admin's language.
export const categorySchema = z.object({
  name: z.string().trim().min(1, { error: () => t('errName') }).max(40, { error: () => t('errNameLong') }),
  nameGujarati: z.string().trim().max(40, { error: () => t('errNameLong') }),
  description: z.string().trim().max(200, { error: () => t('errDescriptionLong') }),
  sortOrder: z.number().int({ error: () => t('errWhole') }).min(0, { error: () => t('errNonNegative') }),
  status: z.enum(['active', 'inactive']),
})
export type CategoryFormValues = z.infer<typeof categorySchema>
