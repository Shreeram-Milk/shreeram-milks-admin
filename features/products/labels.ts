import { liveLabels } from '@/lib/i18n/core'
import type { ProductStatus, PurchaseMethod } from './api'
import { t } from './messages'

export const METHOD_LABELS = liveLabels<PurchaseMethod, 'methodBuyOnce' | 'methodTrial' | 'methodSubscription'>(t, { buy_once: 'methodBuyOnce', trial: 'methodTrial', subscription: 'methodSubscription' })
export const STATUS_LABELS = liveLabels<ProductStatus, 'statusDraft' | 'statusActive' | 'statusInactive'>(t, { draft: 'statusDraft', active: 'statusActive', inactive: 'statusInactive' })
