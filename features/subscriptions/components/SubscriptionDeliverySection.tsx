'use client'

import { useEffect } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { DetailRows } from '@/components/shared/DetailRows'
import { getPrimaryAddress } from '@/features/customers/address'
import type { SubscriptionFormValues } from '../schema'
import type { SubscriptionContext } from '../service'
import { FormSection } from '@/components/shared/FormSection'
import { ServiceabilityNotice } from './ServiceabilityNotice'

type SubscriptionDeliverySectionProps = {
  context: SubscriptionContext
  /** Slot already saved on the subscription being edited; kept visible (as Inactive) if it was retired. */
  existingSlotId: string | null
  customerLocked: boolean
  goToStep: (step: 'customer' | 'product') => void
}

export function SubscriptionDeliverySection({ context, existingSlotId, customerLocked, goToStep }: SubscriptionDeliverySectionProps) {
  const { control, setValue, getValues, formState: { errors } } = useFormContext<SubscriptionFormValues>()
  const slotId = useWatch({ control, name: 'deliverySlotId' })
  const { eligibility, customer, product, slots, cutoffRule } = context
  const allowedKey = eligibility?.allowedSlotIds.join('|') ?? ''

  // Keep the chosen slot valid for the customer's PIN: drop stale picks, auto-select a lone option.
  useEffect(() => {
    if (!eligibility?.serviceable || !eligibility.slotRequired) return
    const current = getValues('deliverySlotId')
    const keepInactive = current !== '' && current === existingSlotId
    if (current && !eligibility.allowedSlotIds.includes(current) && !keepInactive) setValue('deliverySlotId', '', { shouldDirty: true })
    if (!getValues('deliverySlotId') && eligibility.allowedSlotIds.length === 1) setValue('deliverySlotId', eligibility.allowedSlotIds[0], { shouldDirty: true, shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedKey captures allowedSlotIds
  }, [allowedKey, eligibility?.serviceable, eligibility?.slotRequired, existingSlotId, getValues, setValue])

  const changeCustomer = () => { setValue('customerId', '', { shouldDirty: true }); goToStep('customer') }
  const changeProduct = () => { setValue('productId', '', { shouldDirty: true }); setValue('variantId', '', { shouldDirty: true }); setValue('deliverySlotId', '', { shouldDirty: true }); goToStep('product') }

  const slotName = (id: string) => slots.find(slot => slot.id === id)?.name ?? 'Unavailable slot'
  const options = eligibility?.slotRequired ? [
    ...eligibility.allowedSlotIds.map(id => ({ value: id, label: slotName(id) })),
    ...(existingSlotId && eligibility.inactiveSlotIds.includes(existingSlotId) ? [{ value: existingSlotId, label: `${slotName(existingSlotId)} · Inactive`, disabled: slotId !== existingSlotId }] : []),
  ] : []
  const cutoff = eligibility?.cutoffContext.find(item => item.slotId === slotId)
  const address = customer ? getPrimaryAddress(customer) : undefined

  return <FormSection id="subscription-delivery-section" number="04" title="Delivery" description="Slots and cut-off come from the product’s fulfilment profile and the customer’s PIN code.">
    {!customer || !product || !eligibility
      ? <p className="product-hint">Choose a customer and a product to see delivery availability.</p>
      : !eligibility.serviceable
        ? <ServiceabilityNotice reason={eligibility.reason ?? 'Delivery is not available.'} onChangeCustomer={customerLocked ? undefined : changeCustomer} onChangeProduct={changeProduct} />
        : <>
          <div className="product-grid">
            {eligibility.slotRequired
              ? <FormField label="Delivery slot" required error={errors.deliverySlotId?.message} helper={`Slots available for PIN ${address?.pinCode ?? ''}: ${eligibility.allowedSlotIds.map(slotName).join(', ')}.`}>
                <SelectField label="Delivery slot" value={slotId} onChange={value => setValue('deliverySlotId', value, { shouldDirty: true, shouldValidate: true })} placeholder="Select a delivery slot" options={options} />
              </FormField>
              : <div className="schedule-note"><span>Delivery slot</span><strong>Not applicable for shipping</strong></div>}
          </div>
          <div className="product-profile-summary">
            <strong>Ordering cut-off</strong>
            {eligibility.slotRequired
              ? cutoff
                ? <><DetailRows rows={[{ label: 'Selected slot', value: cutoff.slotName }, { label: 'Ordering cut-off', value: cutoff.description }]} /><p className="help-text">{cutoff.slotName} deliveries are subject to the {cutoff.ruleName} rule.</p></>
                : <p className="help-text">{slotId ? (cutoffRule ? 'No cut-off is defined for this slot.' : 'This fulfilment profile has no cut-off rule.') : 'Select a delivery slot to see its cut-off.'}</p>
              : <p className="help-text">Shipping profiles do not use cut-off rules.</p>}
          </div>
        </>}
  </FormSection>
}
