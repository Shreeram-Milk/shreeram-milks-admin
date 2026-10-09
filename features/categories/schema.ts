import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter a category name.').max(40, 'Keep the name under 40 characters.'),
  nameGujarati: z.string().trim().max(40, 'Keep the name under 40 characters.'),
  description: z.string().trim().max(200, 'Keep the description under 200 characters.'),
  sortOrder: z.number().int('Use a whole number.').min(0, 'Use zero or greater.'),
  status: z.enum(['active', 'inactive']),
})
export type CategoryFormValues = z.infer<typeof categorySchema>
