import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Messages } from '@/lib/i18n/core'
import { commonMessages } from '@/lib/i18n/common'
import { layoutMessages } from '@/components/layout/messages'
import { adjustmentMessages } from './adjustment-admin/messages'
import { appSettingsMessages } from './app-settings/messages'
import { authMessages } from './auth/messages'
import { bannerMessages } from './banners/messages'
import { categoryMessages } from './categories/messages'
import { configMessages } from './configuration/messages'
import { creditMessages } from './credit-admin/messages'
import { customerMessages } from './customers/messages'
import { dashboardMessages } from './dashboard/messages'
import { deliveryMessages } from './delivery-admin/messages'
import { faqMessages } from './faqs/messages'
import { moneyMessages } from './money/messages'
import { notificationMessages } from './notifications/messages'
import { offerMessages } from './offers/messages'
import { onboardingMessages } from './onboarding/messages'
import { orderMessages } from './order-admin/messages'
import { paymentMessages } from './payment-admin/messages'
import { policyMessages } from './policies/messages'
import { productionMessages } from './production-admin/messages'
import { productMessages } from './products/messages'
import { subscriptionMessages } from './subscription-admin/messages'
import { supportMessages } from './support-tickets/messages'
import { websiteMessages } from './website/messages'

const lists: Array<[string, Messages<string>]> = Object.entries({
  commonMessages, layoutMessages, adjustmentMessages, appSettingsMessages, authMessages, bannerMessages, categoryMessages, configMessages, creditMessages,
  customerMessages, dashboardMessages, deliveryMessages, faqMessages, moneyMessages, notificationMessages, offerMessages, onboardingMessages, orderMessages,
  paymentMessages, policyMessages, productionMessages, productMessages, subscriptionMessages, supportMessages, websiteMessages,
})

const blanksOf = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort().join(',')

describe('admin word lists', () => {
  for (const [name, list] of lists) {
    it(`${name}: Gujarati has the same keys, blanks and no empty words`, () => {
      assert.deepEqual(Object.keys(list.gu).sort(), Object.keys(list.en).sort())
      for (const key of Object.keys(list.en)) {
        const english = list.en[key] as string
        const gujarati = list.gu[key] as string
        assert.ok(gujarati.trim(), `${name}.${key} is empty in Gujarati`)
        assert.equal(blanksOf(gujarati), blanksOf(english), `${name}.${key} has different {blanks}`)
      }
    })
  }
})
