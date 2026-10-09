import { z } from 'zod'

const INDIAN_MOBILE = /^[6-9]\d{9}$/
const INDIAN_PIN = /^[1-9]\d{5}$/

export const customerSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(120, 'Keep the name under 120 characters.'),
  mobile: z.string().trim().regex(INDIAN_MOBILE, 'Enter a valid 10-digit Indian mobile number.'),
  email: z.string().trim().refine(value => value === '' || z.email().safeParse(value).success, 'Enter a valid email address.'),
  status: z.enum(['active', 'inactive']),
  customerType: z.enum(['prepaid', 'credit'], { error: 'Select a customer type.' }),
  line1: z.string().trim().min(1, 'Address line 1 is required.'),
  line2: z.string().trim(),
  locality: z.string().trim().min(1, 'Area / locality is required.'),
  city: z.string().trim().min(1, 'City is required.'),
  state: z.string().trim().min(1, 'State is required.'),
  pinCode: z.string().trim().regex(INDIAN_PIN, 'Enter a valid 6-digit PIN code.'),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters.'),
})
export type CustomerFormValues = z.infer<typeof customerSchema>
