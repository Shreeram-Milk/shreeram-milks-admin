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
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

const BACK = '/content/offers'
const kinds = () => (Object.keys(OFFER_KIND_LABELS) as OfferKind[]).map(value => ({ value, label: OFFER_KIND_LABELS[value] }))
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
      toast.success(offer ? t('saved') : t('created'))
      router.push(BACK)
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label={t('backToOffers')} onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: t('content') }, { label: t('offers'), href: BACK }, { label: offer ? t('edit') : t('new') }]} /><h1>{offer ? t('editOffer') : t('newOffer')}</h1><p className="page-description">{t('formDescription')}</p></div>
    </div></header>
    <form onSubmit={submit} noValidate className="settings-form">
      <section className="form-card"><h2>{t('customerSees')}</h2>
        <div className="product-grid">
          <FormField label={t('titleEn')} required error={errors.title?.message}><Input {...register('title')} autoComplete="off" maxLength={80} /></FormField>
          <FormField label={t('titleGu')} error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" maxLength={80} /></FormField>
          <FormField label={t('detailsEn')} error={errors.description?.message}><Textarea {...register('description')} rows={3} maxLength={300} /></FormField>
          <FormField label={t('detailsGu')} error={errors.descriptionGu?.message}><Textarea {...register('descriptionGu')} rows={3} maxLength={300} /></FormField>
        </div>
      </section>

      <section className="form-card"><h2>{t('whatItGives')}</h2>
        <div className="product-grid">
          <FormField label={t('typeOfOffer')} helper={OFFER_KIND_HINTS[kind]}><Controller control={control} name="kind" render={({ field }) => <SelectField label={t('typeOfOffer')} placeholder={t('chooseType')} value={field.value} options={kinds()} onChange={field.onChange} />} /></FormField>
          {kind === 'percent' && <>
            <FormField label={t('percentField')} required error={errors.percent?.message} helper={t('percentHelper')}><Input {...register('percent')} inputMode="numeric" autoComplete="off" /></FormField>
            <FormField label={t('upToField')} error={errors.maxDiscount?.message} helper={t('upToHelper')}><Input {...register('maxDiscount')} inputMode="decimal" autoComplete="off" /></FormField>
          </>}
          {kind === 'flat' && <FormField label={t('amountOffField')} required error={errors.flat?.message}><Input {...register('flat')} inputMode="decimal" autoComplete="off" /></FormField>}
          {!isGift && <FormField label={t('minOrder')} error={errors.minOrder?.message} helper={t('minOrderHelper')}><Input {...register('minOrder')} inputMode="decimal" autoComplete="off" /></FormField>}
        </div>
        {isGift && <div className="product-grid">
          <FormField label={t('freeProduct')} required error={errors.giftVariantId?.message}>
            <Controller control={control} name="giftProductId" render={({ field }) => <SelectField label={t('freeProduct')} placeholder={products ? t('chooseProduct') : t('loading')} value={field.value} options={products ?? []} onChange={value => { field.onChange(value); setValue('giftVariantId', '', { shouldDirty: true }) }} />} />
          </FormField>
          <FormField label={t('freeSize')}>
            <Controller control={control} name="giftVariantId" render={({ field }) => <SelectField label={t('freeSize')} placeholder={giftProductId ? t('chooseSize') : t('productFirst')} value={field.value} options={variants.map(variant => ({ value: variant.id, label: `${variant.name} (${formatINR(variant.pricePaise)})` }))} onChange={field.onChange} />} />
          </FormField>
          <FormField label={t('howManyFree')} error={errors.giftQuantity?.message}><Input {...register('giftQuantity')} inputMode="numeric" autoComplete="off" /></FormField>
          <FormField label={t('minBought')} error={errors.minOrder?.message} helper={t('minBoughtHelper')}><Input {...register('minOrder')} inputMode="decimal" autoComplete="off" /></FormField>
        </div>}
      </section>

      <section className="form-card"><h2>{isGift ? t('earnGift') : t('covers')}</h2>
        {!isGift && <FormField label={t('counts')}>
          <Controller control={control} name="scope" render={({ field }) => <SelectField label={t('counts')} placeholder={t('choose')} value={field.value} options={[{ value: 'order', label: t('wholeOrder') }, { value: 'products', label: t('someProducts') }]} onChange={field.onChange} />} />
        </FormField>}
        {(isGift || scope === 'products') && <FormField label={isGift ? t('buyAny') : t('products')} error={errors.productIds?.message}>
          <Controller control={control} name="productIds" render={({ field }) => <ProductChecklist label={t('products')} options={products ?? []} selected={field.value} onChange={ids => setValue('productIds', ids, { shouldDirty: true, shouldValidate: true })} />} />
        </FormField>}
      </section>

      <section className="form-card"><h2>{t('whereWorks')}</h2>
        <div className="product-grid">
          {([['appliesOneTime', t('oneTimePurchases')], ['appliesTrial', t('trials')], ['appliesSubscription', t('subscriptions')]] as const).map(([name, text]) => <label key={name} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Controller control={control} name={name} render={({ field }) => <Checkbox checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} aria-label={text} />} />
            <span>{text}</span>
          </label>)}
        </div>
        {errors.appliesOneTime?.message && <p className="field-error" role="alert">{errors.appliesOneTime.message}</p>}
        {appliesSubscription && <div className="product-grid">
          <FormField label={t('subscriptionAtLeast')} error={errors.minPlanDays?.message} helper={t('subscriptionAtLeastHelper')}><Input {...register('minPlanDays')} inputMode="numeric" autoComplete="off" /></FormField>
        </div>}
        {isGift && <p className="product-hint">{t('giftFirstDelivery')}</p>}
      </section>

      <section className="form-card"><h2>{t('codeDatesLimits')}</h2>
        <div className="product-grid">
          <FormField label={t('offerCode')} error={errors.code?.message} helper={t('offerCodeHelper')}><Input {...register('code')} autoComplete="off" maxLength={20} /></FormField>
          <FormField label={t('starts')} helper={t('startsHelper')}><Controller control={control} name="startsOn" render={({ field }) => <OptionalDateField label={t('startDate')} value={field.value} onChange={field.onChange} placeholder={t('immediately')} />} /></FormField>
          <FormField label={t('ends')} error={errors.endsOn?.message} helper={t('endsHelper')}><Controller control={control} name="endsOn" render={({ field }) => <OptionalDateField label={t('endDate')} value={field.value} onChange={field.onChange} placeholder={t('noEndDate')} />} /></FormField>
          <FormField label={t('totalUses')} error={errors.totalLimit?.message} helper={t('totalUsesHelper')}><Input {...register('totalLimit')} inputMode="numeric" autoComplete="off" /></FormField>
          <FormField label={t('perCustomer')} error={errors.perCustomerLimit?.message} helper={t('perCustomerHelper')}><Input {...register('perCustomerLimit')} inputMode="numeric" autoComplete="off" /></FormField>
          <FormField label={t('status')}><Controller control={control} name="status" render={({ field }) => <SelectField label={t('status')} placeholder={t('chooseStatus')} value={field.value} options={[{ value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} onChange={field.onChange} />} /></FormField>
        </div>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions">
        <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()} disabled={isSubmitting}>{t('cancel')}</Button>
        <Button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? t('saving') : offer ? t('saveChanges') : t('createOffer')}</Button>
      </div>
    </form>
    {dialog}
  </div>
}

/** Shown when an offer can't be found or loaded, with a way back. */
export function OfferNotFound({ message }: { message: string }) {
  return <div className="product-state" role="alert"><strong>{t('notFound')}</strong><span>{message}</span><Link className="secondary-button" href={BACK}>{t('backToOffers')}</Link></div>
}
