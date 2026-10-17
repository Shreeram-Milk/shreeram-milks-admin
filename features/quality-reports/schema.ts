import { z } from 'zod'
import { windowError } from '@/lib/active-window'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')
const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')

export const qualityReportSchema = z.object({
  titleEn: z.string().trim().min(1, 'Enter the title.').max(120, 'Keep the title under 120 characters.'),
  titleGu: z.string().trim().max(120, 'Keep the title under 120 characters.'),
  reportType: z.enum(['lab_report', 'quality_certificate', 'purity_certificate', 'other']),
  productId: z.string(),
  batchReference: z.string().trim().max(60, 'Keep the batch reference under 60 characters.'),
  labName: z.string().trim().min(1, 'Enter the lab or issuer.').max(100, 'Keep the name under 100 characters.'),
  reportDate: isoDate,
  validFrom: isoDateOrEmpty,
  validUntil: isoDateOrEmpty,
  summaryEn: z.string().trim().max(600, 'Keep the summary under 600 characters.'),
  summaryGu: z.string().trim().max(600, 'Keep the summary under 600 characters.'),
  mediaAssetId: z.string(),
}).superRefine((value, context) => {
  const range = windowError(value.validFrom, value.validUntil)
  if (range) context.addIssue({ code: 'custom', path: ['validUntil'], message: range.replace('end date', 'valid-until date').replace('start date', 'valid-from date') })
})
export type QualityReportFormValues = z.infer<typeof qualityReportSchema>
