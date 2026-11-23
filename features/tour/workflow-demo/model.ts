/** All data is an explicit teaching example. These scenes never import an API client or change business records. */
export const DEMO_PAGES = {
  'refund-order': '/orders',
  'refund-payment': '/orders',
  'refund-cancel': '/orders',
  'refund-cancelled': '/orders',
  'refund-owed': '/prepaid-adjustments',
  'refund-review': '/prepaid-adjustments',
  'refund-verify': '/prepaid-adjustments',
  'refund-confirm': '/prepaid-adjustments',
  'refund-pending': '/prepaid-adjustments',
  'refund-completed': '/prepaid-adjustments',
  'refund-ledger': '/online-payments',
  'scratch-settings': '/content/app-settings',
  'scratch-enable': '/content/app-settings',
  'scratch-threshold': '/content/app-settings',
  'scratch-expiry': '/content/app-settings',
  'scratch-settings-save': '/content/app-settings',
  'scratch-offers': '/content/offers',
  'scratch-offer-details': '/content/offers/new',
  'scratch-code': '/content/offers/new',
  'scratch-purchases': '/content/offers/new',
  'scratch-pool': '/content/offers/new',
  'scratch-owner': '/content/offers/new',
  'scratch-offer-save': '/content/offers/new',
  'scratch-delivery': '/deliveries',
  'scratch-card': '/deliveries',
  'scratch-reveal': '/deliveries',
  'scratch-checkout': '/deliveries',
  'scratch-stats': '/content/app-settings',
} as const
export type DemoStage = keyof typeof DEMO_PAGES

export const REFUND_EXAMPLE = {
  customer: 'કિરણભાઈ પટેલ', order: 'SRM-DEMO-1001', payment: 'SRM-DEMO-PAY-1001',
  paidPaise: 12550, refundPaise: 12550, reference: 'OMR-DEMO-1001', reason: 'ગ્રાહકને ઓર્ડર હવે જોઈતો નથી',
} as const
export const SCRATCH_EXAMPLE = {
  minOrderPaise: 50000, expiryDays: 30, offerTitle: 'આવતા ઓર્ડરમાં ₹50 ની છૂટ',
  discountPaise: 5000, code: 'MILK50', qualifyingOrderPaise: 60000,
  nextOrderPaise: 55000, finalPaise: 50000,
} as const
