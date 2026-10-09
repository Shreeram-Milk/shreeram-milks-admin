'use client'

import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { addDays } from '@/lib/business-time'
import type { SubscriptionFormValues } from '../schema'
import type { SubscriptionContext } from '../service'
import { CustomWeekdaySelector } from './CustomWeekdaySelector'
import { FormSection } from '@/components/shared/FormSection'

export function SubscriptionScheduleSection({ context, today }: { context: SubscriptionContext; today: string }) {
  const { control, setValue, getValues, formState: { errors } } = useFormContext<SubscriptionFormValues>()
  const [scheduleType, weekdays, patternDate] = useWatch({ control, name: ['scheduleType', 'weekdays', 'alternatePatternDate'] })
  const options = context.scheduleOptions

  // A single allowed schedule is chosen for the admin; they can still see why it is the only one.
  useEffect(() => {
    if (options.length === 1 && getValues('scheduleType') === '') setValue('scheduleType', options[0].value, { shouldDirty: true })
  }, [options, getValues, setValue])

  const changeType = (next: string) => {
    setValue('scheduleType', next as SubscriptionFormValues['scheduleType'], { shouldDirty: true, shouldValidate: true })
    if (next === 'alternate_days' && !getValues('alternatePatternDate')) setValue('alternatePatternDate', getValues('startDate') || addDays(today, 1), { shouldDirty: true })
  }

  return <FormSection id="subscription-schedule-section" number="03" title="Schedule" description="Schedule options come from the product’s subscription rules.">
    <div className="product-grid">
      <FormField label="Schedule type" required error={errors.scheduleType?.message}>
        <SelectField label="Schedule type" value={scheduleType} onChange={changeType} placeholder={context.product ? 'Select a schedule' : 'Select a product first'} options={options.map(option => ({ value: option.value, label: option.label }))} />
      </FormField>
      {scheduleType === 'daily' && <div className="schedule-note"><span>Delivery frequency</span><strong>Every eligible day</strong></div>}
      {scheduleType === 'alternate_days' && <FormField label="Start pattern date" required error={errors.alternatePatternDate?.message} helper="The subscription will deliver every alternate eligible day starting from this date.">
        <DatePickerField label="Start pattern date" value={patternDate} onChange={value => setValue('alternatePatternDate', value, { shouldDirty: true, shouldValidate: true })} invalid={Boolean(errors.alternatePatternDate)} />
      </FormField>}
    </div>
    {scheduleType === 'custom_weekdays' && <div className="weekday-field">
      <span className="product-form-label" id="weekday-label">Select delivery days <span>*</span></span>
      <CustomWeekdaySelector value={weekdays} onChange={days => setValue('weekdays', days, { shouldDirty: true, shouldValidate: true })} invalid={Boolean(errors.weekdays)} describedBy="weekday-label" />
      {errors.weekdays?.message && <small className="field-error" role="alert">{errors.weekdays.message}</small>}
    </div>}
  </FormSection>
}
