'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import { formatDisplayDate } from '@/lib/business-time'
import { CUSTOMER_TYPE_LABELS } from '@/features/customers/types'
import { getPrimaryAddress } from '@/features/customers/address'
import { describeSchedule } from '../schedule'
import type { SubscriptionFormValues } from '../schema'
import type { SubscriptionContext } from '../service'
import { SCHEDULE_TYPE_LABELS } from '../types'
import { FormSection } from '@/components/shared/FormSection'

export function SubscriptionReview({ context }: { context: SubscriptionContext }) {
  const { control } = useFormContext<SubscriptionFormValues>()
  const [variantId, scheduleType, weekdays, patternDate, slotId, startDate] = useWatch({ control, name: ['variantId', 'scheduleType', 'weekdays', 'alternatePatternDate', 'deliverySlotId', 'startDate'] })
  const { customer, product, variants, profile, slots } = context
  const address = customer ? getPrimaryAddress(customer) : undefined
  const schedule = scheduleType === '' ? '—' : describeSchedule({ scheduleType, weekdays, alternatePatternDate: patternDate || null })
  const scheduleLabel = scheduleType === 'alternate_days' && patternDate ? `${SCHEDULE_TYPE_LABELS.alternate_days} from ${formatDisplayDate(patternDate)}` : schedule
  const rows: Array<[string, string]> = [
    ['Customer', customer?.fullName ?? '—'],
    ['Product', product?.name ?? '—'],
    ['Variant', variants.find(variant => variant.id === variantId)?.name ?? '—'],
    ['Schedule', scheduleLabel],
    ['Delivery slot', slotId ? slots.find(slot => slot.id === slotId)?.name ?? '—' : context.eligibility?.slotRequired === false ? 'Not applicable' : '—'],
    ['Start date', startDate ? formatDisplayDate(startDate) : '—'],
    ['Fulfilment', profile?.name ?? '—'],
    ['PIN', address?.pinCode ?? '—'],
    ['Customer type', customer ? CUSTOMER_TYPE_LABELS[customer.customerType] : '—'],
  ]
  return <FormSection id="subscription-review-section" number="06" title="Review" description="Confirm the details, then create the subscription from the bar below.">
    <div className="product-review-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
  </FormSection>
}
