'use client'

import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { DetailRows } from '@/components/shared/DetailRows'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { FormSection } from '@/components/shared/FormSection'
import type { SubscriptionContext } from '../../subscriptions/service'
import { ServiceabilityNotice } from '../../subscriptions/components/ServiceabilityNotice'
import { orderCutoffStatus } from '../cutoff'
import type { OrderFormValues } from '../schema'

type OrderDeliverySectionProps = {
  context: SubscriptionContext
  today: string
  originalDate: string | null
  originalSlotId: string | null
  customerLocked: boolean
  goToStep: (step: 'customer' | 'items') => void
}

export function OrderDeliverySection({ context, today, originalDate, originalSlotId, customerLocked, goToStep }: OrderDeliverySectionProps) {
  const { control, setValue, getValues, formState: { errors } } = useFormContext<OrderFormValues>()
  const [slotId, deliveryDate] = useWatch({ control, name: ['deliverySlotId', 'deliveryDate'] })
  const { eligibility, slots, customer, product } = context
  const allowedKey = eligibility?.allowedSlotIds.join('|') ?? ''

  // Keep the slot valid for the customer's PIN: drop stale picks, auto-select a lone option.
  useEffect(() => {
    if (!eligibility?.serviceable || !eligibility.slotRequired) return
    const current = getValues('deliverySlotId')
    const keepInactive = current !== '' && current === originalSlotId
    if (current && !eligibility.allowedSlotIds.includes(current) && !keepInactive) setValue('deliverySlotId', '', { shouldDirty: true })
    if (!getValues('deliverySlotId') && eligibility.allowedSlotIds.length === 1) setValue('deliverySlotId', eligibility.allowedSlotIds[0], { shouldDirty: true, shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedKey captures allowedSlotIds
  }, [allowedKey, eligibility?.serviceable, eligibility?.slotRequired, originalSlotId, getValues, setValue])

  const slotName = (id: string) => slots.find(slot => slot.id === id)?.name ?? 'Unavailable slot'
  const options = eligibility?.slotRequired ? [
    ...eligibility.allowedSlotIds.map(id => ({ value: id, label: slotName(id) })),
    ...(originalSlotId && eligibility.inactiveSlotIds.includes(originalSlotId) ? [{ value: originalSlotId, label: `${slotName(originalSlotId)} · Inactive`, disabled: slotId !== originalSlotId }] : []),
  ] : []
  const cutoff = eligibility?.slotRequired && slotId && deliveryDate ? orderCutoffStatus(context, slotId, deliveryDate) : null

  return <FormSection id="order-delivery-section" number="03" title="Delivery" description="Slots and cut-off come from the product’s fulfilment profile and the customer’s PIN code.">
    {!customer || !product || !eligibility
      ? <p className="product-hint">Choose a customer and add an item to see delivery availability.</p>
      : !eligibility.serviceable
        ? <ServiceabilityNotice reason={eligibility.reason ?? 'Delivery is not available.'} onChangeCustomer={customerLocked ? undefined : () => { setValue('customerId', '', { shouldDirty: true }); goToStep('customer') }} onChangeProduct={() => goToStep('items')} />
        : <>
          <div className="product-grid">
            {eligibility.slotRequired
              ? <FormField label="Delivery slot" required error={errors.deliverySlotId?.message} helper={`Slots available for this PIN: ${eligibility.allowedSlotIds.map(slotName).join(', ')}.`}>
                <SelectField label="Delivery slot" value={slotId} onChange={value => setValue('deliverySlotId', value, { shouldDirty: true, shouldValidate: true })} placeholder="Select a delivery slot" options={options} />
              </FormField>
              : <div className="schedule-note"><span>Delivery slot</span><strong>Not applicable for this fulfilment</strong></div>}
            <FormField label="Delivery date" required error={errors.deliveryDate?.message} helper={originalDate && originalDate < today ? 'The original date has passed; choose a new one to reschedule.' : 'Cannot be before today.'}>
              <DatePickerField label="Delivery date" value={deliveryDate} minDate={today} invalid={Boolean(errors.deliveryDate)} onChange={value => setValue('deliveryDate', value, { shouldDirty: true, shouldValidate: true })} />
            </FormField>
          </div>
          {eligibility.slotRequired && <div className="product-profile-summary">
            <strong>Ordering cut-off</strong>
            {cutoff
              ? <><DetailRows rows={[{ label: 'Status', value: cutoff.label }, { label: 'Rule', value: cutoff.ruleName }]} />{cutoff.state === 'passed' && <p className="help-text">The cut-off has passed for this slot and date. The order can still be created, but production may already be planned.</p>}</>
              : <p className="help-text">{slotId && deliveryDate ? 'No cut-off is defined for this slot.' : 'Select a slot and date to see the cut-off.'}</p>}
          </div>}
        </>}
  </FormSection>
}
