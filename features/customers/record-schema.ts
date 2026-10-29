import { z } from 'zod'
import { liveLabels } from '@/lib/i18n/core'
import { t } from './messages'

/** The staff form for a customer. The server checks the same rules again. Messages are looked up when shown, in the admin's language. */
export const customerRecordSchema = z.object({
  name: z.string().trim().max(100, { error: () => t('nameTooLong') }),
  customerType: z.enum(['prepaid', 'credit'], { error: () => t('selectType') }),
  adminNote: z.string().trim().max(500, { error: () => t('noteTooLong') }),
})
export type CustomerRecordFormValues = z.infer<typeof customerRecordSchema>

export const CUSTOMER_RECORD_STATUS_LABELS = liveLabels(t, { active: 'statusActive', blocked: 'statusBlocked', deleted: 'statusDeleted' })
export const CUSTOMER_RECORD_TYPE_LABELS = liveLabels(t, { prepaid: 'typePrepaid', credit: 'typeCredit' })

export const ADDRESS_LABELS = liveLabels(t, { home: 'labelHome', work: 'labelWork', other: 'labelOther' })
export const DROP_LOCATION_LABELS = liveLabels(t, { 'front-door': 'dropFrontDoor', 'side-gate': 'dropSideGate', 'milk-box': 'dropMilkBox', 'security-desk': 'dropSecurityDesk' })
export const HANDOFF_LABELS = liveLabels(t, { 'hand-to-me': 'handToMe', 'leave-at-door': 'leaveAtDoor', 'milk-box': 'putInMilkBox', security: 'giveSecurity' })

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
