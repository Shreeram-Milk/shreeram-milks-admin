import { z } from 'zod'

/** The staff form for a customer. The server checks the same rules again. */
export const customerRecordSchema = z.object({
  name: z.string().trim().max(100, 'Keep the name under 100 characters.'),
  customerType: z.enum(['prepaid', 'credit'], { error: 'Select a customer type.' }),
  adminNote: z.string().trim().max(500, 'Keep the note under 500 characters.'),
})
export type CustomerRecordFormValues = z.infer<typeof customerRecordSchema>

export const CUSTOMER_RECORD_STATUS_LABELS = { active: 'Active', blocked: 'Blocked', deleted: 'Deleted' } as const
export const CUSTOMER_RECORD_TYPE_LABELS = { prepaid: 'Prepaid', credit: 'Credit' } as const

export const ADDRESS_LABELS = { home: 'Home', work: 'Work', other: 'Other' } as const
export const DROP_LOCATION_LABELS = { 'front-door': 'Front door', 'side-gate': 'Side gate', 'milk-box': 'Milk box', 'security-desk': 'Security desk' } as const
export const HANDOFF_LABELS = { 'hand-to-me': 'Hand it to me', 'leave-at-door': 'Leave at the door', 'milk-box': 'Put in the milk box', security: 'Give to security' } as const

/** The customer ids staff can open are UUIDs. Sample pages that are not connected yet link with other ids. */
export const isCustomerId = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** "+919824612345" -> "+91 98246 12345". Anything unexpected (or a deleted account's blank) reads naturally. */
export function formatCustomerPhone(phone: string | null): string {
  if (!phone) return '—'
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone)
  return match ? `+91 ${match[1]} ${match[2]}` : phone
}

/** A customer who has not told us their name yet still needs something readable in a list. */
export const customerDisplayName = (customer: { name: string; phone: string | null; email?: string }): string => customer.name.trim() || customer.email || formatCustomerPhone(customer.phone)
