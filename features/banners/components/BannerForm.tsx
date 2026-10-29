'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { FormField } from '@/components/configuration/FormField'
import { OptionalDateField } from '@/components/shared/OptionalDateField'
import { ImageUploadField } from '@/components/shared/ImageUploadField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { describeApiError } from '@/lib/api-errors'
import { bannerApi } from '../api'
import { useLinkTargets } from '../links'
import { bannerSchema, type BannerFormValues } from '../schema'
import { BANNER_AUDIENCE_LABELS, BANNER_CTA_LABELS, BANNER_TAB_LABELS, BANNER_TYPE_DESCRIPTIONS, BANNER_TYPE_LABELS, type Banner, type BannerAudience, type BannerCtaType, type BannerInput, type BannerType } from '../types'
import { tc } from '@/lib/i18n/common'
import { t } from '../messages'

const audiences = () => (Object.keys(BANNER_AUDIENCE_LABELS) as BannerAudience[]).map(value => ({ value, label: BANNER_AUDIENCE_LABELS[value] }))
const ctaTypes = () => (Object.keys(BANNER_CTA_LABELS) as BannerCtaType[]).map(value => ({ value, label: BANNER_CTA_LABELS[value] }))

const blank = (type: BannerType, sortOrder: number): BannerFormValues => ({ type, audience: 'all_users', titleEn: '', titleGu: '', messageEn: '', messageGu: '', labelEn: '', labelGu: '', imageAssetId: null, ctaType: 'none', ctaTarget: '', startDate: '', endDate: '', sortOrder, status: 'active' })
const fromBanner = (banner: Banner): BannerFormValues => ({ type: banner.type, audience: banner.audience, titleEn: banner.titleEn, titleGu: banner.titleGu, messageEn: banner.messageEn, messageGu: banner.messageGu, labelEn: banner.labelEn, labelGu: banner.labelGu, imageAssetId: banner.imageAssetId, ctaType: banner.ctaType, ctaTarget: banner.ctaTarget, startDate: banner.startDate ?? '', endDate: banner.endDate ?? '', sortOrder: banner.sortOrder, status: banner.status })
/** The form keeps "no date" as an empty string; the API wants null. */
const toInput = (values: BannerFormValues): BannerInput => ({ ...values, startDate: values.startDate || null, endDate: values.endDate || null })

type Props = { banner: Banner | null; type: BannerType; nextSortOrder?: number }

/**
 * One banner on its own page. The type is fixed by the tab it was opened from, so there is no type dropdown:
 * each kind of banner is added and edited in its own place.
 */
export function BannerForm({ banner, type, nextSortOrder = 1 }: Props) {
  const router = useRouter()
  const backPath = `/content/banners?type=${type}`
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<BannerFormValues>({ resolver: zodResolver(bannerSchema), defaultValues: banner ? fromBanner(banner) : blank(type, nextSortOrder) })
  const ctaType = useWatch({ control, name: 'ctaType' })
  const linkTargets = useLinkTargets()
  const [error, setError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, backPath)
  const label = BANNER_TYPE_LABELS[type]

  const submit = handleSubmit(async values => {
    setError('')
    try {
      if (banner) await bannerApi.update(banner.id, toInput(values))
      else await bannerApi.create(toInput(values))
      toast.success(banner ? t('saved', { label }) : t('created', { label }))
      // Saved: nothing is unsaved any more, so leaving must not ask again.
      router.push(backPath)
    } catch (failure) {
      setError(describeApiError(failure))
    }
  })

  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label={t('backTo', { noun: BANNER_TAB_LABELS[type].toLowerCase() })} onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: t('content') }, { label: t('banners'), href: backPath }, { label: BANNER_TAB_LABELS[type], href: backPath }, { label: banner ? t('edit') : t('new') }]} /><h1>{banner ? t('editLabel', { label: label.toLowerCase() }) : t('newLabel', { label: label.toLowerCase() })}</h1><p className="page-description">{BANNER_TYPE_DESCRIPTIONS[type]}</p></div>
    </div></header>
    <form onSubmit={submit} noValidate className="settings-form">
      <section className="form-card"><h2>{t('message')}</h2>
        <div className="product-grid">
          <FormField label={t('headlineEn')} required error={errors.titleEn?.message}><Input {...register('titleEn')} autoComplete="off" /></FormField>
          <FormField label={t('headlineGu')} error={errors.titleGu?.message}><Input {...register('titleGu')} autoComplete="off" /></FormField>
          <FormField label={t('textEn')} error={errors.messageEn?.message}><Textarea {...register('messageEn')} rows={3} maxLength={160} /></FormField>
          <FormField label={t('textGu')} error={errors.messageGu?.message}><Textarea {...register('messageGu')} rows={3} maxLength={160} /></FormField>
          <FormField label={t('labelEn')} error={errors.labelEn?.message} helper={t('labelHelper')}><Input {...register('labelEn')} autoComplete="off" maxLength={24} /></FormField>
          <FormField label={t('labelGu')} error={errors.labelGu?.message}><Input {...register('labelGu')} autoComplete="off" maxLength={24} /></FormField>
        </div>
        {type === 'warning'
          ? <p className="product-hint">{t('warningNoPicture')}</p>
          : <Controller control={control} name="imageAssetId" render={({ field }) => type === 'promotion'
            ? <ImageUploadField purpose="banner" label={t('picture')} hint={t('pictureHint')} currentUrl={banner?.imageUrl ?? null} hasImage={Boolean(field.value)} onChange={id => setValue('imageAssetId', id, { shouldDirty: true })} onBusyChange={setImageBusy} />
            : <ImageUploadField purpose="banner_icon" label={t('icon')} hint={t('iconHint')} currentUrl={banner?.imageUrl ?? null} hasImage={Boolean(field.value)} onChange={id => setValue('imageAssetId', id, { shouldDirty: true })} onBusyChange={setImageBusy} />} />}
      </section>
      <section className="form-card"><h2>{t('whereItGoes')}</h2>
        <div className="product-grid">
          <FormField label={t('shownTo')}><Controller control={control} name="audience" render={({ field }) => <SelectField label={t('audience')} placeholder={t('chooseAudience')} value={field.value} options={audiences()} onChange={field.onChange} />} /></FormField>
          <FormField label={t('opensWhenTapped')}><Controller control={control} name="ctaType" render={({ field }) => <SelectField label={t('opens')} placeholder={t('ctaNone')} value={field.value} options={ctaTypes()} onChange={value => { field.onChange(value); setValue('ctaTarget', '', { shouldDirty: true }) }} />} /></FormField>
          {ctaType !== 'none' && ctaType !== 'offers' && <FormField label={ctaType === 'category' ? t('category') : t('product')} error={errors.ctaTarget?.message}>
            <Controller control={control} name="ctaTarget" render={({ field }) => <SelectField label={t('linkTarget')} placeholder={ctaType === 'category' ? t('chooseCategory') : t('chooseProduct')} value={field.value} options={linkTargets.options(ctaType)} onChange={value => field.onChange(value)} />} />
          </FormField>}
        </div>
      </section>
      <section className="form-card"><h2>{t('whenItRuns')}</h2>
        <div className="product-grid">
          <FormField label={t('starts')} helper={t('startsHelper')}><Controller control={control} name="startDate" render={({ field }) => <OptionalDateField label={t('startDate')} value={field.value} onChange={field.onChange} placeholder={t('immediately')} />} /></FormField>
          <FormField label={t('ends')} error={errors.endDate?.message} helper={t('endsHelper')}><Controller control={control} name="endDate" render={({ field }) => <OptionalDateField label={t('endDate')} value={field.value} onChange={field.onChange} placeholder={t('noEndDate')} />} /></FormField>
          <FormField label={t('displayOrder')} error={errors.sortOrder?.message} helper={t('displayOrderHelper')}><Input {...register('sortOrder', { valueAsNumber: true })} type="number" min={0} inputMode="numeric" /></FormField>
          <FormField label={t('status')}><Controller control={control} name="status" render={({ field }) => <SelectField label={t('status')} placeholder={t('chooseStatus')} value={field.value} options={[{ value: 'active', label: tc('active') }, { value: 'inactive', label: tc('inactive') }]} onChange={field.onChange} />} /></FormField>
        </div>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions">
        <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()} disabled={isSubmitting}>{t('cancel')}</Button>
        <Button type="submit" className="primary-button" disabled={isSubmitting || imageBusy}>{isSubmitting ? t('saving') : banner ? t('saveChanges') : t('createLabel', { label })}</Button>
      </div>
    </form>
    {dialog}
  </div>
}

/** Shown when a banner can't be found or loaded, with a way back. */
export function BannerNotFound({ message }: { message: string }) {
  return <div className="product-state" role="alert"><strong>{t('notFound')}</strong><span>{message}</span><Link className="secondary-button" href="/content/banners">{t('backToBanners')}</Link></div>
}
