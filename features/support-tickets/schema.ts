import { z } from 'zod'

export const MESSAGE_MAX_LENGTH = 1000

export const newTicketSchema = z.object({
  customerId: z.string().min(1, 'Choose the customer.'),
  orderId: z.string(),
  category: z.enum(['delivery_missing', 'late_delivery', 'wrong_product', 'quality', 'payment', 'subscription', 'address', 'other']),
  description: z.string().trim().min(1, 'Describe the issue.').max(MESSAGE_MAX_LENGTH, `Keep this under ${MESSAGE_MAX_LENGTH} characters.`),
})
export type NewTicketFormValues = z.infer<typeof newTicketSchema>

export const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply first.').max(MESSAGE_MAX_LENGTH, `Keep this under ${MESSAGE_MAX_LENGTH} characters.`),
})
export type ReplyFormValues = z.infer<typeof replySchema>
