'use client'

import { useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { DetailRows } from '@/components/shared/DetailRows'
import type { SubscriptionFormValues } from '../schema'
import { subscriptionService, type SubscriptionContext } from '../service'
import { FormSection } from '@/components/shared/FormSection'

export function SubscriptionProductSelector({ context, keepProductId }: { context: SubscriptionContext; keepProductId: string | undefined }) {
  const { control, setValue, getValues, formState: { errors } } = useFormContext<SubscriptionFormValues>()
  const [productId, variantId] = useWatch({ control, name: ['productId', 'variantId'] })
  const products = useMemo(() => subscriptionService.listSubscribableProducts(keepProductId), [keepProductId])
  const { product, variants, profile, scheduleOptions } = context

  const changeProduct = (nextId: string) => {
    setValue('productId', nextId, { shouldDirty: true, shouldValidate: true })
    // Anything derived from the previous product's rules must be re-chosen.
    setValue('variantId', '', { shouldDirty: true })
    setValue('deliverySlotId', '', { shouldDirty: true })
    const nextOptions = subscriptionService.resolveContext({ customerId: getValues('customerId'), productId: nextId }).scheduleOptions
    const currentType = getValues('scheduleType')
    if (currentType && !nextOptions.some(option => option.value === currentType)) setValue('scheduleType', '', { shouldDirty: true })
  }

  return <FormSection id="subscription-product-section" number="02" title="Product" description="Only active products that offer a subscription are listed.">
    <div className="product-grid">
      <FormField label="Product" required error={errors.productId?.message}>
        <SelectField label="Product" value={productId} onChange={changeProduct} placeholder={products.length ? 'Select a product' : 'No subscription products available'} options={products.map(item => ({ value: item.id, label: item.status === 'active' ? item.name : `${item.name} · Inactive` }))} />
      </FormField>
      <FormField label="Variant" required error={errors.variantId?.message}>
        <SelectField label="Variant" value={variantId} onChange={value => setValue('variantId', value, { shouldDirty: true, shouldValidate: true })} placeholder={product ? 'Select a variant' : 'Select a product first'} options={variants.map(variant => ({ value: variant.id, label: variant.status === 'active' ? variant.name : `${variant.name} · Inactive`, disabled: variant.status !== 'active' && variant.id !== variantId }))} />
      </FormField>
    </div>
    {product && <div className="product-profile-summary">
      <strong>Derived from the product</strong>
      <DetailRows rows={[
        { label: 'Fulfilment profile', value: profile ? `${profile.name}${profile.status === 'inactive' ? ' · Inactive' : ''}` : 'Not set' },
        { label: 'Available schedules', value: scheduleOptions.length ? scheduleOptions.map(option => option.label).join(', ') : 'None configured' },
      ]} />
    </div>}
    {product && scheduleOptions.length === 0 && <p className="field-error" role="alert">This product has no active subscription schedules, so it cannot be subscribed to.</p>}
  </FormSection>
}
