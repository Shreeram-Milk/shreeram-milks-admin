'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import { FormSection } from '@/components/shared/FormSection'
import { CustomerPicker } from '@/features/customers/components/CustomerPicker'
import type { Customer } from '@/features/customers/types'
import type { SubscriptionFormValues } from '../schema'

export function CustomerSection({ locked, customer, inactive }: { locked: boolean; customer: Customer | undefined; inactive: boolean }) {
  const { control, setValue, formState: { errors } } = useFormContext<SubscriptionFormValues>()
  const customerId = useWatch({ control, name: 'customerId' })
  return <FormSection id="subscription-customer-section" number="01" title="Customer" description="Choose an active customer. Their PIN code decides what can be delivered.">
    <CustomerPicker
      customer={customerId ? customer : undefined}
      locked={locked}
      onSelect={picked => setValue('customerId', picked.id, { shouldDirty: true, shouldValidate: true })}
      onClear={() => setValue('customerId', '', { shouldDirty: true })}
      error={errors.customerId?.message}
      warning={inactive ? 'This customer is inactive. Activate them, or choose another customer, before creating a subscription.' : undefined}
    />
  </FormSection>
}
