'use client'

import { useEffect, useState } from 'react'
import { Controller, useFieldArray, useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/configuration/FormField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { websiteApi } from './api'
import { websiteHomeSchema, type WebsiteHome, type WebsiteHomeFormValues } from './schema'

const MAX_CARDS = 4

function toForm(home: WebsiteHome): WebsiteHomeFormValues {
  const { updatedAt, ...values } = home
  void updatedAt // a save time, not something staff edit
  return values
}

type CardListName = 'highlights' | 'steps'

/** A list of up to four title + one-line cards (highlights and steps share this). */
function CardList({ name, title, hint, addLabel, control, register, errors }: {
  name: CardListName; title: string; hint: string; addLabel: string
  control: Control<WebsiteHomeFormValues>; register: UseFormRegister<WebsiteHomeFormValues>; errors: FieldErrors<WebsiteHomeFormValues>
}) {
  const { fields, append, remove } = useFieldArray({ control, name })
  const listError = errors[name]?.root?.message ?? errors[name]?.message
  return <section className="form-card"><h2>{title}s</h2>
    <p className="product-hint">{hint}</p>
    {fields.map((field, index) => <div key={field.id} className="product-grid">
      <FormField label={`${title} ${index + 1}: title`} error={errors[name]?.[index]?.title?.message}><Input {...register(`${name}.${index}.title`)} autoComplete="off" maxLength={40} /></FormField>
      <FormField label="One line about it" error={errors[name]?.[index]?.text?.message}><Textarea {...register(`${name}.${index}.text`)} rows={2} maxLength={160} /></FormField>
      <div><Button type="button" variant="outline" className="secondary-button" onClick={() => remove(index)}><Trash2 size={15} aria-hidden="true" /> Remove {title.toLowerCase()} {index + 1}</Button></div>
    </div>)}
    {listError && <small className="field-error">{listError}</small>}
    <div><Button type="button" variant="outline" className="secondary-button" disabled={fields.length >= MAX_CARDS} onClick={() => append({ title: '', text: '' })}><Plus size={15} aria-hidden="true" /> {addLabel}</Button></div>
  </section>
}

function WebsiteHomeForm({ initial }: { initial: WebsiteHome }) {
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState('')
  const { register, handleSubmit, control, reset, formState: { errors, isDirty, isSubmitting } } = useForm<WebsiteHomeFormValues>({ resolver: zodResolver(websiteHomeSchema), defaultValues: toForm(saved) })
  const submit = handleSubmit(async values => {
    setError('')
    try {
      const next = await websiteApi.saveHome(values)
      setSaved(next)
      reset(toForm(next))
      toast.success('Home page saved. The website updates within a few minutes.')
    } catch (failure) {
      setError(describeApiError(failure))
    }
  }, () => { toast.error('Some fields need attention.') })

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Website' }, { label: 'Home page' }]} /><h1>Home page</h1><p className="page-description">The words and links on the front page of shreerammilk.com. Last saved {formatTimestamp(saved.updatedAt)}.</p></div>
    </header>
    <form onSubmit={submit} noValidate className="settings-form">
      <section className="form-card"><h2>Top of the page</h2>
        <div className="product-grid">
          <FormField label="Announcement line" error={errors.announcement?.message} helper="Optional. A thin line across the top, for example “Now delivering in Gandhinagar”. Leave empty to hide it."><Input {...register('announcement')} autoComplete="off" maxLength={140} /></FormField>
          <FormField label="Main heading" error={errors.heroTitle?.message}><Input {...register('heroTitle')} autoComplete="off" maxLength={80} /></FormField>
          <FormField label="Sub-heading" error={errors.heroSubtitle?.message}><Textarea {...register('heroSubtitle')} rows={2} maxLength={240} /></FormField>
          <FormField label="Main picture link" error={errors.heroImageUrl?.message} helper="Optional. A full link starting with https://."><Input {...register('heroImageUrl')} inputMode="url" autoComplete="off" placeholder="https://" /></FormField>
        </div>
      </section>
      <CardList name="highlights" title="Highlight" hint="Short reasons to choose ShreeRam Milks. Up to 4." addLabel="Add highlight" control={control} register={register} errors={errors} />
      <CardList name="steps" title="Step" hint="How ordering works, in order. Up to 4." addLabel="Add step" control={control} register={register} errors={errors} />
      <section className="form-card"><h2>Products</h2>
        <div className="switch-list"><Controller control={control} name="showProducts" render={({ field }) => <div className="switch-row"><div><label htmlFor="show-products">Show our products</label><small className="help-text">Shows product names, photos and “from” prices from your product list.</small></div><Switch id="show-products" checked={field.value} onCheckedChange={field.onChange} /></div>} /></div>
        <div className="product-grid"><FormField label="Products heading" error={errors.productsTitle?.message}><Input {...register('productsTitle')} autoComplete="off" maxLength={60} /></FormField></div>
      </section>
      <section className="form-card"><h2>Get the app</h2>
        <div className="product-grid">
          <FormField label="Heading" error={errors.ctaTitle?.message}><Input {...register('ctaTitle')} autoComplete="off" maxLength={80} /></FormField>
          <FormField label="Text" error={errors.ctaText?.message}><Textarea {...register('ctaText')} rows={2} maxLength={200} /></FormField>
          <FormField label="Google Play link" error={errors.playStoreUrl?.message} helper="Leave empty until the app is live. The website then shows “Coming soon on Google Play”."><Input {...register('playStoreUrl')} inputMode="url" autoComplete="off" placeholder="https://play.google.com/store/apps/details?id=…" /></FormField>
        </div>
      </section>
      <section className="form-card"><h2>What Google shows</h2>
        <div className="product-grid">
          <FormField label="Title" error={errors.seoTitle?.message}><Input {...register('seoTitle')} autoComplete="off" maxLength={70} /></FormField>
          <FormField label="Description" error={errors.seoDescription?.message}><Textarea {...register('seoDescription')} rows={2} maxLength={170} /></FormField>
        </div>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions"><Button type="button" variant="outline" className="secondary-button" disabled={!isDirty} onClick={() => reset(toForm(saved))}>Discard changes</Button><Button type="submit" className="primary-button" disabled={!isDirty || isSubmitting}>Save Home page</Button></div>
    </form>
  </div>
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; home: WebsiteHome }

/** Loads the saved Home page text from the backend, then shows the form. */
export function WebsiteHomeWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    websiteApi.getHome().then(
      home => { if (!cancelled) setState({ status: 'ready', home }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>The Home page could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div>
  return <WebsiteHomeForm initial={state.home} />
}
