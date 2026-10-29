import { currentLanguage } from '@/lib/i18n/core'

export type SupportCategory = 'delivery_missing' | 'late_delivery' | 'wrong_product' | 'quality_issue' | 'payment_issue' | 'subscription_issue' | 'address_issue' | 'other'

export type SupportCategoryInfo = { id: SupportCategory; labelEn: string; labelGu: string; iconKey: string; sortOrder: number }

/**
 * The issue types the customer app's Help screen offers. One list serves tickets and Help Center articles so the
 * two can never drift apart. It is fixed configuration, not something staff create; the app will read it from the API.
 */
export const SUPPORT_CATEGORIES: SupportCategoryInfo[] = [
  { id: 'delivery_missing', labelEn: 'Delivery not received', labelGu: 'ડિલિવરી મળી નથી', iconKey: 'package-x', sortOrder: 1 },
  { id: 'late_delivery', labelEn: 'Late delivery', labelGu: 'મોડી ડિલિવરી', iconKey: 'clock', sortOrder: 2 },
  { id: 'wrong_product', labelEn: 'Wrong product', labelGu: 'ખોટી પ્રોડક્ટ', iconKey: 'shuffle', sortOrder: 3 },
  { id: 'quality_issue', labelEn: 'Quality issue', labelGu: 'ગુણવત્તાની સમસ્યા', iconKey: 'badge-alert', sortOrder: 4 },
  { id: 'payment_issue', labelEn: 'Payment issue', labelGu: 'ચુકવણીની સમસ્યા', iconKey: 'credit-card', sortOrder: 5 },
  { id: 'subscription_issue', labelEn: 'Subscription issue', labelGu: 'સબ્સ્ક્રિપ્શનની સમસ્યા', iconKey: 'repeat', sortOrder: 6 },
  { id: 'address_issue', labelEn: 'Address issue', labelGu: 'સરનામાની સમસ્યા', iconKey: 'map-pin', sortOrder: 7 },
  { id: 'other', labelEn: 'Other', labelGu: 'અન્ય', iconKey: 'help-circle', sortOrder: 8 },
]

export const SUPPORT_CATEGORY_IDS = SUPPORT_CATEGORIES.map(category => category.id) as [SupportCategory, ...SupportCategory[]]
/** Each category's name in the admin's language (Gujarati or English), read when used. */
export const SUPPORT_CATEGORY_LABELS = Object.defineProperties({}, Object.fromEntries(SUPPORT_CATEGORIES.map(category => [category.id, { enumerable: true, get: () => (currentLanguage() === 'gu' ? category.labelGu : category.labelEn) }]))) as Readonly<Record<SupportCategory, string>>
