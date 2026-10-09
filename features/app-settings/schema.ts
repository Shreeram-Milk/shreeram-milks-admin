import { z } from 'zod'

export const appSettingsSchema = z.object({
  supportPhone: z.string().trim().refine(value => value === '' || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(value), 'Enter a 10-digit Indian mobile number.'),
  supportEmail: z.string().trim().max(120).refine(value => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address.'),
  supportHours: z.string().trim().max(80, 'Keep this under 80 characters.'),
  supportHoursGujarati: z.string().trim().max(80, 'Keep this under 80 characters.'),
  deliveryPromise: z.string().trim().max(120, 'Keep this under 120 characters.'),
  deliveryPromiseGujarati: z.string().trim().max(120, 'Keep this under 120 characters.'),
  minimumAppVersion: z.string().trim().regex(/^\d+\.\d+\.\d+$/, 'Use the format 1.0.0.'),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().max(200, 'Keep this under 200 characters.'),
}).superRefine((value, context) => {
  if (value.maintenanceMode && !value.maintenanceMessage) context.addIssue({ code: 'custom', path: ['maintenanceMessage'], message: 'Tell customers why the app is unavailable.' })
})
export type AppSettingsFormValues = z.infer<typeof appSettingsSchema>
