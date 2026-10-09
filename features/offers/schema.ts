import { z } from 'zod'
import { windowError } from '@/lib/active-window'
import { parseRupeesToPaise } from '@/lib/money'

const isoDateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a valid date.')

/** Form values keep amounts as text (rupees or percent); the dialog converts to paise on save. */
export const offerSchema = z.object({
  name: z.string().trim().min(1, 'Enter an offer name.').max(60, 'Keep the name under 60 characters.'),
  nameGujarati: z.string().trim().max(60, 'Keep the name under 60 characters.'),
  description: z.string().trim().max(200, 'Keep the description under 200 characters.'),
  code: z.string().trim().toUpperCase().refine(value => value === '' || /^[A-Z0-9]{3,20}$/.test(value), 'Use 3–20 letters or digits, or leave empty.'),
  discountType: z.enum(['percent', 'flat']),
  value: z.string().trim().min(1, 'Enter the discount.'),
  minOrder: z.string().trim().refine(value => value === '' || parseRupeesToPaise(value) !== null, 'Enter an amount like 250 or 250.50.'),
  appliesTo: z.enum(['all_orders', 'subscriptions', 'first_order']),
  startDate: isoDateOrEmpty,
  endDate: isoDateOrEmpty,
  status: z.enum(['active', 'inactive']),
}).superRefine((form, context) => {
  if (form.discountType === 'percent') {
    const percent = Number(form.value)
    if (!/^\d{1,3}$/.test(form.value) || percent < 1 || percent > 100) context.addIssue({ code: 'custom', path: ['value'], message: 'Enter a whole percentage from 1 to 100.' })
  } else if ((parseRupeesToPaise(form.value) ?? 0) <= 0) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'Enter an amount greater than zero.' })
  }
  const range = windowError(form.startDate, form.endDate)
  if (range) context.addIssue({ code: 'custom', path: ['endDate'], message: range })
})
export type OfferFormValues = z.infer<typeof offerSchema>
