import { z } from 'zod'
import { t } from './messages'

// Messages are looked up when shown, so they follow the admin's language.
const indianMobile = () => z.string().trim().refine(value => value === '' || /^(\+91)?[6-9]\d{9}$/.test(value.replace(/[\s-]/g, '')), { error: () => t('errMobile') })
const short = (max: number) => z.string().trim().max(max, { error: () => t('errTooLong', { max }) })

export const appSettingsSchema = z.object({
  supportPhone: indianMobile(),
  supportEmail: z.string().trim().max(120).refine(value => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), { error: () => t('errEmail') }),
  supportWhatsApp: indianMobile(),
  callEnabled: z.boolean(),
  chatEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  supportHoursEn: short(80),
  supportHoursGu: short(80),
  afterHoursMessageEn: short(160),
  afterHoursMessageGu: short(160),
  deliveryPromiseEn: short(120),
  deliveryPromiseGu: short(120),
  minimumAppVersion: z.string().trim().regex(/^\d+\.\d+\.\d+$/, { error: () => t('errVersion') }),
  maintenanceMode: z.boolean(),
  maintenanceMessageEn: short(200),
  maintenanceMessageGu: short(200),
  showMaintenanceContact: z.boolean(),
  flags: z.object({ showTrials: z.boolean(), showSubscriptions: z.boolean(), showOffers: z.boolean(), showQualityReports: z.boolean(), showSeasonalBanner: z.boolean() }),
}).superRefine((value, context) => {
  if (value.callEnabled && !value.supportPhone) context.addIssue({ code: 'custom', path: ['supportPhone'], message: t('errCallNeedsPhone') })
  if (value.whatsappEnabled && !value.supportWhatsApp) context.addIssue({ code: 'custom', path: ['supportWhatsApp'], message: t('errWhatsappNeedsNumber') })
  if (value.maintenanceMode && !value.maintenanceMessageEn) context.addIssue({ code: 'custom', path: ['maintenanceMessageEn'], message: t('errMaintenanceMessage') })
  if (value.showMaintenanceContact && !value.supportPhone && !value.supportEmail && !value.supportWhatsApp) context.addIssue({ code: 'custom', path: ['showMaintenanceContact'], message: t('errContactNeeded') })
})
export type AppSettingsFormValues = z.infer<typeof appSettingsSchema>
