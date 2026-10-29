import { layoutMessages } from '@/components/layout/messages'
import { translator } from '@/lib/i18n/core'

const t = translator(layoutMessages)

/** The setup screens that have a plain-language explanation behind an "i" button. */
export type SetupScreen = 'categories' | 'deliverySlots' | 'deliveryAreas' | 'orderByTimes' | 'trialPlans' | 'subscriptionRules'

const HELP_KEY = {
  categories: 'helpCategories', deliverySlots: 'helpDeliverySlots', deliveryAreas: 'helpDeliveryAreas',
  orderByTimes: 'helpOrderByTimes', trialPlans: 'helpTrialPlans', subscriptionRules: 'helpSubscriptionRules',
} as const satisfies Record<SetupScreen, keyof typeof layoutMessages.en>

/** The explanation of a setup screen, in the admin's language. */
export const setupHelp = (screen: SetupScreen): string => t(HELP_KEY[screen])
