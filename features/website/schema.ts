import { z } from 'zod'

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`)
const required = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters.`)
/** Empty, or a full https link (the website only shows secure links and pictures). */
const httpsLink = z.string().trim().max(500, 'This link is too long.').refine(value => value === '' || /^https:\/\/[^\s]+$/.test(value), 'Use a full link starting with https://')

const card = z.object({ title: required(40, 'Add a short title.'), text: required(160, 'Add one line about it.') })

/** The same rules as the backend; the backend checks again on save. */
export const websiteHomeSchema = z.object({
  announcement: optionalText(140),
  heroTitle: required(80, 'Add the main heading.'),
  heroSubtitle: optionalText(240),
  heroImageUrl: httpsLink,
  highlights: z.array(card).max(4, 'Up to 4 highlights.'),
  steps: z.array(card).max(4, 'Up to 4 steps.'),
  showProducts: z.boolean(),
  productsTitle: optionalText(60),
  ctaTitle: optionalText(80),
  ctaText: optionalText(200),
  playStoreUrl: httpsLink,
  seoTitle: required(70, 'Add the title Google shows.'),
  seoDescription: required(170, 'Add the line Google shows under the title.'),
})

export type WebsiteHomeFormValues = z.infer<typeof websiteHomeSchema>
export type WebsiteHome = WebsiteHomeFormValues & { updatedAt: string }
