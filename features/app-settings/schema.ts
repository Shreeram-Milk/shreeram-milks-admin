import { z } from 'zod'

const indianMobile = (message: string) => z.string().trim().refine(value => value === '' || /^(\+91)?[6-9]\d{9}$/.test(value.replace(/[\s-]/g, '')), message)
const short = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`)

export const appSettingsSchema = z.object({
  supportPhone: indianMobile('Enter a 10-digit Indian mobile number.'),
  supportEmail: z.string().trim().max(120).refine(value => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.'),
  supportWhatsApp: indianMobile('Enter a 10-digit Indian mobile number.'),
  callEnabled: z.boolean(),
  chatEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  supportHoursEn: short(80),
  supportHoursGu: short(80),
  afterHoursMessageEn: short(160),
  afterHoursMessageGu: short(160),
  deliveryPromiseEn: short(120),
  deliveryPromiseGu: short(120),
  minimumAppVersion: z.string().trim().regex(/^\d+\.\d+\.\d+$/, 'Use the format 1.0.0.'),
  maintenanceMode: z.boolean(),
  maintenanceMessageEn: short(200),
  maintenanceMessageGu: short(200),
  showMaintenanceContact: z.boolean(),
  flags: z.object({ showTrials: z.boolean(), showSubscriptions: z.boolean(), showOffers: z.boolean(), showQualityReports: z.boolean(), showSeasonalBanner: z.boolean() }),
}).superRefine((value, context) => {
  if (value.callEnabled && !value.supportPhone) context.addIssue({ code: 'custom', path: ['supportPhone'], message: 'Add a support phone number to turn calling on.' })
  if (value.whatsappEnabled && !value.supportWhatsApp) context.addIssue({ code: 'custom', path: ['supportWhatsApp'], message: 'Add a WhatsApp number to turn WhatsApp on.' })
  if (value.maintenanceMode && !value.maintenanceMessageEn) context.addIssue({ code: 'custom', path: ['maintenanceMessageEn'], message: 'Tell customers why the app is unavailable.' })
  if (value.showMaintenanceContact && !value.supportPhone && !value.supportEmail && !value.supportWhatsApp) context.addIssue({ code: 'custom', path: ['showMaintenanceContact'], message: 'Add a support phone, email or WhatsApp number first.' })
})
export type AppSettingsFormValues = z.infer<typeof appSettingsSchema>
