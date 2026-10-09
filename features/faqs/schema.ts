import { z } from 'zod'

export const faqSchema = z.object({
  topic: z.enum(['delivery', 'subscription', 'payments', 'account', 'other']),
  question: z.string().trim().min(1, 'Enter the question.').max(160, 'Keep the question under 160 characters.'),
  questionGujarati: z.string().trim().max(160, 'Keep the question under 160 characters.'),
  answer: z.string().trim().min(1, 'Enter the answer.').max(800, 'Keep the answer under 800 characters.'),
  answerGujarati: z.string().trim().max(800, 'Keep the answer under 800 characters.'),
  sortOrder: z.number().int('Use a whole number.').min(0, 'Use zero or greater.'),
  status: z.enum(['active', 'inactive']),
})
export type FaqFormValues = z.infer<typeof faqSchema>
