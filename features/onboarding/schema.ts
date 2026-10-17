import { z } from 'zod'

export const slideSchema = z.object({
  imageAssetId: z.string().min(1, 'Choose an image.'),
  titleEn: z.string().trim().min(1, 'Enter the headline.').max(80, 'Keep the headline under 80 characters.'),
  titleGu: z.string().trim().max(80, 'Keep the headline under 80 characters.'),
  descriptionEn: z.string().trim().min(1, 'Enter the text.').max(200, 'Keep the text under 200 characters.'),
  descriptionGu: z.string().trim().max(200, 'Keep the text under 200 characters.'),
  status: z.enum(['active', 'inactive']),
})
export type SlideFormValues = z.infer<typeof slideSchema>
