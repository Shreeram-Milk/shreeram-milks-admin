import { z } from 'zod'

export const MESSAGE_MAX_LENGTH = 1000

export const replySchema = z.object({
  body: z.string().trim().min(1, 'Write a reply first.').max(MESSAGE_MAX_LENGTH, `Keep this under ${MESSAGE_MAX_LENGTH} characters.`),
})
export type ReplyFormValues = z.infer<typeof replySchema>
