'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { OptionalDateField } from '@/components/shared/OptionalDateField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { describeApiError } from '@/lib/api-errors'
import { formatINR } from '@/lib/money'
import { productApi, type ProductVariant } from '../../products/api'
import { offerApi } from '../api'
import { blankOffer, fromOffer, offerSchema, toInput, type OfferFormValues } from '../schema'
import { OFFER_KIND_HINTS, OFFER_KIND_LABELS, type Offer, type OfferKind } from '../types'
import { ProductChecklist } from './ProductChecklist'

const BACK = '/content/offers'
const KINDS = (Object.keys(OFFER_KIND_LABELS) as OfferKind[]).map(value => ({ value, label: OFFER_KIND_LABELS[value] }))
/** The most products the pickers list. A catalogue larger than this needs a searchable picker. */
const MAX_PRODUCT_CHOICES = 100

type Option = { value: string; label: string }

/** The live products, loaded once for the pickers. If they cannot be read the form still opens and says so. */
function useProductOptions() {
  const [options, setOptions] = useState<Option[] | null>(null)
  useEffect(() => {
    let cancelled = false
    productApi.list({ search: '', status: 'active', categoryId: '', page: 1, pageSize: MAX_PRODUCT_CHOICES }).then(
      result => { if (!cancelled) setOptions(result.rows.map(item => ({ value: item.id, label: item.name }))) },
      () => { if (!cancelled) setOptions([]) },
    )
    return () => { cancelled = true }
  }, [])
  return options
}

/** The sizes of the chosen gift product, loaded when a product is chosen. */
function useVariants(productId: string) {
  const [state, setState] = useState<{ productId: string; variants: ProductVariant[] } | null>(null)
  useEffect(() => {
    if (!productId) return
    let cancelled = false
    productApi.get(productId).then(
      product => { if (!cancelled) setState({ productId, variants: product.variants.filter(variant => variant.status === 'active') }) },
      () => { if (!cancelled) setState({ productId, variants: [] }) },
    )
    return () => { cancelled = true }
  }, [productId])
  return state?.productId === productId ? state.variants : []
}

/** One offer on its own page: what it gives, where it works, how long it runs and how often it can be used. */
export function OfferForm({ offer }: { offer: Offer | null }) {
  const router = useRouter()
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<OfferFormValues>({ resolver: zodResolver(offerSchema), defaultValues: offer ? fromOffer(offer) : blankOffer })
  const [kind, scope, giftProductId, appliesSubscription] = useWatch({ control, name: ['kind', 'scope', 'giftProductId', 'appliesSubscription'] })
  const [error, setError] = useState('')
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, BACK)
  const products = useProductOptions()
  const variants = useVariants(giftProductId)
  const isGift = kind === 'free_gift'

  const submit = handleSubmit(async values => {
    setError('')
    try {
      if (offer) await offerApi.update(offer.id, toInput(values))
      else await offerApi.create(toInput(values))
      toast.success(offer ? 'Offer saved.' : 'Offer created.')
      router.push(BACK)
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label="Back to offers" onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'Offers', href: BACK }, { label: offer ? 'Edit' : 'New' }]} /><h1>{offer ? 'Edit offer' : 'New offer'}</h1><p className="page-description">A customer gets one offer at a time. If a code is set, the customer types it; with no code, the offer applies by itself.</p></div>
    </div></header>
    <form onSubmit={submit} noValidate className="settings-form">
      <section className="form-card"><h2>What the customer sees</h2>
        <div className="product-grid">
          <FormField label="Title (English)" required error={errors.title?.message}><Input {...register('title')} autoComplete="off" maxLength={80} /></FormField>
          <FormField label="Title (Gujarati)" error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" maxLength={80} /></FormField>
          <FormField label="Details (English)" error={errors.description?.message}><Textarea {...register('description')} rows={3} maxLength={300} /></FormField>
          <FormField label="Details (Gujarati)" error={errors.descriptionGu?.message}><Textarea {...register('descriptionGu')} rows={3} maxLength={300} /></FormField>
        </div>
      </section>

      <section className="form-card"><h2>What it gives</h2>
        <div className="product-grid">
          <FormField label="Type of offer" helper={OFFER_KIND_HINTS[kind]}><Controller control={control} name="kind" render={({ field }) => <SelectField label="Type of offer" placeholder="Choose a type" value={field.value} options={KINDS} onChange={field.onChange} />} /></FormField>
          {kind === 'percent' && <>
            <FormField label="Percent off" required error={errors.percent?.message} helper="1 to 99."><Input {...register('percent')} inputMode="numeric" autoComplete="off" /></FormField>
            <FormField label="Up to (₹)" error={errors.maxDiscount?.message} helper="The most one order can get off. Leave empty for no cap."><Input {...register('maxDiscount')} inputMode="decimal" autoComplete="off" /></FormField>
          </>}
          {kind === 'flat' && <FormField label="Amount off (₹)" required error={errors.flat?.message}><Input {...register('flat')} inputMode="decimal" autoComplete="off" /></FormField>}
          {!isGift && <FormField label="Minimum order (₹)" error={errors.minOrder?.message} helper="Leave empty for no minimum."><Input {...register('minOrder')} inputMode="decimal" autoComplete="off" /></FormField>}
        </div>
        {isGift && <div className="product-grid">
          <FormField label="Free product" required error={errors.giftVariantId?.message}>
            <Controller control={control} name="giftProductId" render={({ field }) => <SelectField label="Free product" placeholder={products ? 'Choose a product' : 'Loading…'} value={field.value} options={products ?? []} onChange={value => { field.onChange(value); setValue('giftVariantId', '', { shouldDirty: true }) }} />} />
          </FormField>
          <FormField label="Free size">
            <Controller control={control} name="giftVariantId" render={({ field }) => <SelectField label="Free size" placeholder={giftProductId ? 'Choose a size' : 'Choose a product first'} value={field.value} options={variants.map(variant => ({ value: variant.id, label: `${variant.name} (${formatINR(variant.pricePaise)})` }))} onChange={field.onChange} />} />
          </FormField>
          <FormField label="How many free" error={errors.giftQuantity?.message}><Input {...register('giftQuantity')} inputMode="numeric" autoComplete="off" /></FormField>
          <FormField label="Minimum bought (₹)" error={errors.minOrder?.message} helper="What the customer must spend on the products below. Leave empty for none."><Input {...register('minOrder')} inputMode="decimal" autoComplete="off" /></FormField>
        </div>}
      </section>

      <section className="form-card"><h2>{isGift ? 'Which products earn the gift' : 'Which products it covers'}</h2>
        {!isGift && <FormField label="Counts">
          <Controller control={control} name="scope" render={({ field }) => <SelectField label="Counts" placeholder="Choose" value={field.value} options={[{ value: 'order', label: 'The whole order' }, { value: 'products', label: 'Only some products' }]} onChange={field.onChange} />} />
        </FormField>}
        {(isGift || scope === 'products') && <FormField label={isGift ? 'Buy any of these' : 'Products'} error={errors.productIds?.message}>
          <Controller control={control} name="productIds" render={({ field }) => <ProductChecklist label="Products" options={products ?? []} selected={field.value} onChange={ids => setValue('productIds', ids, { shouldDirty: true, shouldValidate: true })} />} />
        </FormField>}
      </section>

      <section className="form-card"><h2>Where it works</h2>
        <div className="product-grid">
          {([['appliesOneTime', 'One-time purchases'], ['appliesTrial', 'Trials'], ['appliesSubscription', 'Subscriptions']] as const).map(([name, text]) => <label key={name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Controller control={control} name={name} render={({ field }) => <Checkbox checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} aria-label={text} />} />
            <span>{text}</span>
          </label>)}
        </div>
        {errors.appliesOneTime?.message && <p className="field-error" role="alert">{errors.appliesOneTime.message}</p>}
        {appliesSubscription && <div className="product-grid">
          <FormField label="Subscription at least (days)" error={errors.minPlanDays?.message} helper="For example 30 for a 30-day plan. Leave empty for any length."><Input {...register('minPlanDays')} inputMode="numeric" autoComplete="off" /></FormField>
        </div>}
        {isGift && <p className="product-hint">With a trial or subscription the gift is delivered with the first delivery only. If that delivery is skipped or paused, it goes with the next one.</p>}
      </section>

      <section className="form-card"><h2>Code, dates and limits</h2>
        <div className="product-grid">
          <FormField label="Offer code" error={errors.code?.message} helper="Leave empty and the offer applies by itself. Or set a code like WELCOME20 that the customer types."><Input {...register('code')} autoComplete="off" maxLength={20} /></FormField>
          <FormField label="Starts" helper="Leave empty to start straight away."><Controller control={control} name="startsOn" render={({ field }) => <OptionalDateField label="Start date" value={field.value} onChange={field.onChange} placeholder="Immediately" />} /></FormField>
          <FormField label="Ends" error={errors.endsOn?.message} helper="Leave empty to run until turned off."><Controller control={control} name="endsOn" render={({ field }) => <OptionalDateField label="End date" value={field.value} onChange={field.onChange} placeholder="No end date" />} /></FormField>
          <FormField label="Total uses" error={errors.totalLimit?.message} helper="Across all customers. Leave empty for no limit."><Input {...register('totalLimit')} inputMode="numeric" autoComplete="off" /></FormField>
          <FormField label="Uses per customer" error={errors.perCustomerLimit?.message} helper="Leave empty for no limit."><Input {...register('perCustomerLimit')} inputMode="numeric" autoComplete="off" /></FormField>
          <FormField label="Status"><Controller control={control} name="status" render={({ field }) => <SelectField label="Status" placeholder="Choose a status" value={field.value} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onChange={field.onChange} />} /></FormField>
        </div>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions">
        <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : offer ? 'Save Changes' : 'Create Offer'}</Button>
      </div>
    </form>
    {dialog}
  </div>
}

/** Shown when an offer can't be found or loaded, with a way back. */
export function OfferNotFound({ message }: { message: string }) {
  return <div className="product-state" role="alert"><strong>This offer could not be opened</strong><span>{message}</span><Link className="secondary-button" href={BACK}>Back to offers</Link></div>
}
