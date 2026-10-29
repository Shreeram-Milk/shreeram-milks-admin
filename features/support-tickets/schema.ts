import { z } from 'zod'
import { t } from './messages'

export const MESSAGE_MAX_LENGTH = 1000

export const replySchema = z.object({
  body: z.string().trim().min(1, { error: () => t('writeReply') }).max(MESSAGE_MAX_LENGTH, { error: () => t('replyTooLong', { max: MESSAGE_MAX_LENGTH }) }),
})
export type ReplyFormValues = z.infer<typeof replySchema>
