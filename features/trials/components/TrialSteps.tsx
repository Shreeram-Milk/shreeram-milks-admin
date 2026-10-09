'use client'

import { useEffect, useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { DetailRows } from '@/components/shared/DetailRows'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { FormSection } from '@/components/shared/FormSection'
import { addDays, formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { CUSTOMER_TYPE_LABELS } from '../../customers/types'
import { getPrimaryAddress } from '../../customers/address'
import { ServiceabilityNotice } from '../../subscriptions/components/ServiceabilityNotice'
import { trialEndDate } from '../generation'
import type { TrialFormValues } from '../schema'
import { trialService, type TrialContext } from '../service'

export function TrialProductStep({ context }: { context: TrialContext }) {
  const { control, setValue, formState: { errors } } = useFormContext<TrialFormValues>()
  const [productId, variantId] = useWatch({ control, name: ['productId', 'variantId'] })
  const products = useMemo(() => trialService.listTrialProducts(), [])
  const { product } = context.fulfilment
  const variants = (product?.variants ?? []).filter(variant => variant.status === 'active')

  const changeProduct = (nextId: string) => {
    setValue('productId', nextId, { shouldDirty: true, shouldValidate: true })
    // Plans, slots and variants depend on the product, so they must be re-chosen.
    setValue('variantId', '', { shouldDirty: true })
    setValue('trialPlanId', '', { shouldDirty: true })
    setValue('deliverySlotId', '', { shouldDirty: true })
  }
  return <FormSection id="trial-product-section" number="02" title="Product" description="Only active products that offer a trial are listed.">
    <div className="product-grid">
      <FormField label="Product" required error={errors.productId?.message}>
        <SelectField label="Product" value={productId} onChange={changeProduct} placeholder={products.length ? 'Select a product' : 'No trial products available'} options={products.map(item => ({ value: item.id, label: item.name }))} />
      </FormField>
      <FormField label="Variant" required error={errors.variantId?.message}>
        <SelectField label="Variant" value={variantId} onChange={value => setValue('variantId', value, { shouldDirty: true, shouldValidate: true })} placeholder={product ? 'Select a variant' : 'Select a product first'} options={variants.map(variant => ({ value: variant.id, label: `${variant.name} · ${formatINR(variant.pricePaise)}` }))} />
      </FormField>
    </div>
    {context.fulfilment.profile && <div className="product-profile-summary"><strong>Derived from the product</strong><DetailRows rows={[{ label: 'Fulfilment profile', value: context.fulfilment.profile.name }, { label: 'Trial plans offered', value: context.plans.length ? context.plans.map(plan => plan.name).join(', ') : 'None active' }]} /></div>}
  </FormSection>
}

export function TrialPlanStep({ context }: { context: TrialContext }) {
  const { control, setValue, formState: { errors } } = useFormContext<TrialFormValues>()
  const planId = useWatch({ control, name: 'trialPlanId' })
  const selected = context.plans.find(plan => plan.id === planId)
  return <FormSection id="trial-plan-section" number="03" title="Trial plan" description="Plans come from the product’s trial configuration.">
    <div className="product-grid">
      <FormField label="Trial plan" required error={errors.trialPlanId?.message}>
        <SelectField label="Trial plan" value={planId} onChange={value => setValue('trialPlanId', value, { shouldDirty: true, shouldValidate: true })} placeholder={context.fulfilment.product ? (context.plans.length ? 'Select a plan' : 'No active plans for this product') : 'Select a product first'} options={context.plans.map(plan => ({ value: plan.id, label: `${plan.name} · ${plan.duration} days` }))} />
      </FormField>
      {selected && <div className="schedule-note"><span>Duration</span><strong>{selected.duration} {selected.duration === 1 ? 'day' : 'days'}, one delivery per day</strong></div>}
    </div>
  </FormSection>
}

export function TrialDeliveryStep({ context, customerLocked, goToStep }: { context: TrialContext; customerLocked: boolean; goToStep: (step: 'customer' | 'product') => void }) {
  const { control, setValue, getValues, formState: { errors } } = useFormContext<TrialFormValues>()
  const slotId = useWatch({ control, name: 'deliverySlotId' })
  const { eligibility, slots, customer, product } = context.fulfilment
  const allowedKey = eligibility?.allowedSlotIds.join('|') ?? ''
  useEffect(() => {
    if (!eligibility?.serviceable || !eligibility.slotRequired) return
    const current = getValues('deliverySlotId')
    if (current && !eligibility.allowedSlotIds.includes(current)) setValue('deliverySlotId', '', { shouldDirty: true })
    if (!getValues('deliverySlotId') && eligibility.allowedSlotIds.length === 1) setValue('deliverySlotId', eligibility.allowedSlotIds[0], { shouldDirty: true, shouldValidate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedKey captures allowedSlotIds
  }, [allowedKey, eligibility?.serviceable, eligibility?.slotRequired, getValues, setValue])
  const slotName = (id: string) => slots.find(slot => slot.id === id)?.name ?? 'Unavailable slot'
  return <FormSection id="trial-delivery-section" number="04" title="Delivery" description="Slots come from the product’s fulfilment profile and the customer’s PIN code.">
    {!customer || !product || !eligibility
      ? <p className="product-hint">Choose a customer and a product to see delivery availability.</p>
      : !eligibility.serviceable
        ? <ServiceabilityNotice reason={eligibility.reason ?? 'Delivery is not available.'} onChangeCustomer={customerLocked ? undefined : () => { setValue('customerId', '', { shouldDirty: true }); goToStep('customer') }} onChangeProduct={() => { setValue('productId', '', { shouldDirty: true }); setValue('variantId', '', { shouldDirty: true }); goToStep('product') }} />
        : eligibility.slotRequired
          ? <div className="product-grid"><FormField label="Delivery slot" required error={errors.deliverySlotId?.message} helper={`Slots available for this PIN: ${eligibility.allowedSlotIds.map(slotName).join(', ')}.`}>
            <SelectField label="Delivery slot" value={slotId} onChange={value => setValue('deliverySlotId', value, { shouldDirty: true, shouldValidate: true })} placeholder="Select a delivery slot" options={eligibility.allowedSlotIds.map(id => ({ value: id, label: slotName(id) }))} />
          </FormField></div>
          : <div className="schedule-note"><span>Delivery slot</span><strong>Not applicable for this fulfilment</strong></div>}
  </FormSection>
}

export function TrialStartStep({ today, context }: { today: string; context: TrialContext }) {
  const { control, setValue, formState: { errors } } = useFormContext<TrialFormValues>()
  const [startDate, planId] = useWatch({ control, name: ['startDate', 'trialPlanId'] })
  const plan = context.plans.find(item => item.id === planId)
  return <FormSection id="trial-start-section" number="05" title="Start date" description="The first trial delivery happens on this day.">
    <div className="product-grid">
      <FormField label="Start date" required error={errors.startDate?.message} helper={plan && startDate ? `The ${plan.duration}-day trial ends on ${formatDisplayDate(trialEndDate(startDate, plan.duration))}.` : 'Cannot be before today.'}>
        <DatePickerField label="Start date" value={startDate} minDate={today} invalid={Boolean(errors.startDate)} onChange={value => setValue('startDate', value, { shouldDirty: true, shouldValidate: true })} />
      </FormField>
    </div>
  </FormSection>
}

export function TrialReview({ context }: { context: TrialContext }) {
  const { control } = useFormContext<TrialFormValues>()
  const [variantId, planId, slotId, startDate] = useWatch({ control, name: ['variantId', 'trialPlanId', 'deliverySlotId', 'startDate'] })
  const { customer, product, profile, slots, eligibility } = context.fulfilment
  const plan = context.plans.find(item => item.id === planId)
  const variant = product?.variants.find(item => item.id === variantId)
  const address = customer ? getPrimaryAddress(customer) : undefined
  const rows: Array<[string, string]> = [
    ['Customer', customer?.fullName ?? '—'],
    ['Product', product?.name ?? '—'],
    ['Variant', variant?.name ?? '—'],
    ['Trial plan', plan ? `${plan.name} · ${plan.duration} days` : '—'],
    ['Delivery slot', slotId ? slots.find(slot => slot.id === slotId)?.name ?? '—' : eligibility?.slotRequired === false ? 'Not applicable' : '—'],
    ['Start date', startDate ? formatDisplayDate(startDate) : '—'],
    ['End date', plan && startDate ? formatDisplayDate(addDays(startDate, plan.duration - 1)) : '—'],
    ['Fulfilment', profile?.name ?? '—'],
    ['PIN', address?.pinCode ?? '—'],
    ['Customer type', customer ? CUSTOMER_TYPE_LABELS[customer.customerType] : '—'],
  ]
  return <FormSection id="trial-review-section" number="06" title="Review" description="Confirm the trial. One delivery is scheduled for each day.">
    <div className="product-review-grid">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
  </FormSection>
}
