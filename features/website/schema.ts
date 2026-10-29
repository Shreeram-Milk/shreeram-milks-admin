import { z } from 'zod'
import { t } from './messages'

type Key = Parameters<typeof t>[0]
// Messages are looked up when shown, so they follow the admin's language.
const optionalText = (max: number) => z.string().trim().max(max, { error: () => t('errTooLong', { max }) })
const required = (max: number, message: Key) => z.string().trim().min(1, { error: () => t(message) }).max(max, { error: () => t('errTooLong', { max }) })
/** Empty, or a full https link (the website only shows secure links and pictures). */
const httpsLink = z.string().trim().max(500, { error: () => t('errLinkLong') }).refine(value => value === '' || /^https:\/\/[^\s]+$/.test(value), { error: () => t('errHttps') })

const card = z.object({ title: required(40, 'errCardTitle'), text: required(160, 'errCardText') })

/** The same rules as the backend; the backend checks again on save. */
export const websiteHomeSchema = z.object({
  announcement: optionalText(140),
  heroTitle: required(80, 'errHeading'),
  heroSubtitle: optionalText(240),
  heroImageUrl: httpsLink,
  highlights: z.array(card).max(4, { error: () => t('errHighlights') }),
  steps: z.array(card).max(4, { error: () => t('errSteps') }),
  showProducts: z.boolean(),
  productsTitle: optionalText(60),
  ctaTitle: optionalText(80),
  ctaText: optionalText(200),
  playStoreUrl: httpsLink,
  seoTitle: required(70, 'errSeoTitle'),
  seoDescription: required(170, 'errSeoDescription'),
})

export type WebsiteHomeFormValues = z.infer<typeof websiteHomeSchema>
export type WebsiteHome = WebsiteHomeFormValues & { updatedAt: string }
