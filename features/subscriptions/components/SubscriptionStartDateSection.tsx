'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import { FormField } from '@/components/configuration/FormField'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { formatDisplayDate } from '@/lib/business-time'
import type { SubscriptionFormValues } from '../schema'
import { FormSection } from '@/components/shared/FormSection'

export function SubscriptionStartDateSection({ today, originalStartDate }: { today: string; originalStartDate: string | undefined }) {
  const { control, setValue, formState: { errors } } = useFormContext<SubscriptionFormValues>()
  const startDate = useWatch({ control, name: 'startDate' })
  // A subscription that already began keeps its start date; edits apply to upcoming deliveries.
  const started = originalStartDate !== undefined && originalStartDate <= today
  return <FormSection id="subscription-start-section" number="05" title="Start date" description="The first day deliveries can begin.">
    <div className="product-grid">
      <FormField label="Start date" required error={errors.startDate?.message} helper={started ? `Started on ${formatDisplayDate(originalStartDate)}. Changes apply to upcoming deliveries.` : 'Cannot be before today.'}>
        <DatePickerField label="Start date" value={startDate} minDate={today} disabled={started} invalid={Boolean(errors.startDate)} onChange={value => setValue('startDate', value, { shouldDirty: true, shouldValidate: true })} />
      </FormField>
    </div>
  </FormSection>
}
