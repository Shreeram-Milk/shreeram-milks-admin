import { z } from 'zod'

export const PUSH_TITLE_MAX = 60
export const PUSH_BODY_MAX = 178
/** One SMS segment of plain text. */
export const SMS_BODY_MAX = 160

export const templateSchema = z.object({
  pushEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  title: z.string().trim().min(1, 'Enter a title.').max(PUSH_TITLE_MAX, `Keep the title under ${PUSH_TITLE_MAX} characters.`),
  titleGujarati: z.string().trim().max(PUSH_TITLE_MAX, `Keep the title under ${PUSH_TITLE_MAX} characters.`),
  body: z.string().trim().min(1, 'Enter the message.').max(PUSH_BODY_MAX, `Keep the message under ${PUSH_BODY_MAX} characters.`),
  bodyGujarati: z.string().trim().max(PUSH_BODY_MAX, `Keep the message under ${PUSH_BODY_MAX} characters.`),
  status: z.enum(['active', 'inactive']),
}).superRefine((value, context) => {
  if (!value.pushEnabled && !value.smsEnabled && value.status === 'active') context.addIssue({ code: 'custom', path: ['pushEnabled'], message: 'Turn on at least one channel, or set the template to inactive.' })
  if (value.smsEnabled && value.body.length > SMS_BODY_MAX) context.addIssue({ code: 'custom', path: ['body'], message: `SMS messages must be ${SMS_BODY_MAX} characters or fewer.` })
})
export type TemplateFormValues = z.infer<typeof templateSchema>

export const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(PUSH_TITLE_MAX, `Keep the title under ${PUSH_TITLE_MAX} characters.`),
  titleGujarati: z.string().trim().max(PUSH_TITLE_MAX, `Keep the title under ${PUSH_TITLE_MAX} characters.`),
  body: z.string().trim().min(1, 'Enter the message.').max(PUSH_BODY_MAX, `Keep the message under ${PUSH_BODY_MAX} characters.`),
  bodyGujarati: z.string().trim().max(PUSH_BODY_MAX, `Keep the message under ${PUSH_BODY_MAX} characters.`),
  audience: z.enum(['all', 'prepaid', 'credit', 'subscribers']),
  channel: z.enum(['push', 'sms', 'both']),
}).superRefine((value, context) => {
  if (value.channel !== 'push' && value.body.length > SMS_BODY_MAX) context.addIssue({ code: 'custom', path: ['body'], message: `SMS messages must be ${SMS_BODY_MAX} characters or fewer.` })
})
export type BroadcastFormValues = z.infer<typeof broadcastSchema>

export const scheduleSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time.'),
})
export type ScheduleFormValues = z.infer<typeof scheduleSchema>
