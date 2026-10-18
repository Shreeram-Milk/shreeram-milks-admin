'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormField } from '@/components/configuration/FormField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { formatTimestamp } from '@/lib/business-time'
import { appSettingsApi } from './api'
import { appSettingsSchema, type AppSettingsFormValues } from './schema'
import { FEATURE_FLAG_KEYS, FEATURE_FLAG_LABELS, type AppSettings } from './types'

const TABS = [
  { value: 'support', label: 'Support' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'features', label: 'Features' },
  { value: 'availability', label: 'Availability' },
] as const
type TabValue = (typeof TABS)[number]['value']

/** Which tab each field lives on, so a mistake on a hidden tab takes the admin straight to it. */
const TAB_OF_FIELD: Record<string, TabValue> = {
  supportPhone: 'support', supportEmail: 'support', supportWhatsApp: 'support', callEnabled: 'support', chatEnabled: 'support', whatsappEnabled: 'support',
  supportHoursEn: 'support', supportHoursGu: 'support', afterHoursMessageEn: 'support', afterHoursMessageGu: 'support',
  deliveryPromiseEn: 'delivery', deliveryPromiseGu: 'delivery',
  flags: 'features',
  minimumAppVersion: 'availability', maintenanceMode: 'availability', maintenanceMessageEn: 'availability', maintenanceMessageGu: 'availability', showMaintenanceContact: 'availability',
}

function toForm(settings: AppSettings): AppSettingsFormValues {
  const { updatedAt, ...values } = settings
  void updatedAt // a save time, not something staff edit
  return values
}

/** A labelled on/off switch with its explanation and optional error, wired to the form. */
function SwitchRow({ id, label, detail, error, checked, onChange, disabled }: { id: string; label: string; detail?: string; error?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className="switch-row"><div><label htmlFor={id}>{label}</label>{detail && <small className="help-text">{detail}</small>}{error && <small className="field-error">{error}</small>}</div><Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} /></div>
}

function AppSettingsForm({ initial }: { initial: AppSettings }) {
  // The form owns the values from here on; `saved` only tracks the last save.
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabValue>('support')
  const { register, handleSubmit, control, reset, formState: { errors, isDirty, isSubmitting } } = useForm<AppSettingsFormValues>({ resolver: zodResolver(appSettingsSchema), defaultValues: toForm(saved) })
  const maintenanceMode = useWatch({ control, name: 'maintenanceMode' })
  const submit = handleSubmit(async values => {
    setError('')
    try {
      const next = await appSettingsApi.save(values)
      setSaved(next)
      reset(toForm(next))
      toast.success('App settings saved.')
    } catch (failure) {
      setError(describeApiError(failure))
    }
  }, (invalid: FieldErrors<AppSettingsFormValues>) => {
    // A mistake on a tab that is not showing would otherwise look like Save doing nothing.
    const first = Object.keys(invalid).map(field => TAB_OF_FIELD[field]).find(Boolean)
    if (first) setTab(first)
    toast.error('Some settings need attention.')
  })
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'App Settings' }]} /><h1>App Settings</h1><p className="page-description">Support details, feature switches and availability for the customer app. Last saved {formatTimestamp(saved.updatedAt)}.</p></div>
    </header>
    <form onSubmit={submit} noValidate className="settings-form">
      <Tabs value={tab} onValueChange={value => setTab(value as TabValue)}>
        <TabsList aria-label="Settings sections">{TABS.map(item => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}</TabsList>
      <TabsContent value="support" className="settings-tab">
      <section className="form-card"><h2>Support contact</h2>
        <div className="product-grid">
          <FormField label="Support phone" error={errors.supportPhone?.message} helper="Used by Call support."><Input {...register('supportPhone')} inputMode="tel" autoComplete="off" placeholder="9876543210" /></FormField>
          <FormField label="WhatsApp number" error={errors.supportWhatsApp?.message}><Input {...register('supportWhatsApp')} inputMode="tel" autoComplete="off" placeholder="9876543210" /></FormField>
          <FormField label="Support email" error={errors.supportEmail?.message}><Input {...register('supportEmail')} inputMode="email" autoComplete="off" /></FormField>
        </div>
        <div className="switch-list">
          <Controller control={control} name="callEnabled" render={({ field }) => <SwitchRow id="call-enabled" label="Call support" detail="Shows the Call button in Help." error={errors.supportPhone?.message} checked={field.value} onChange={field.onChange} />} />
          <Controller control={control} name="whatsappEnabled" render={({ field }) => <SwitchRow id="whatsapp-enabled" label="WhatsApp support" detail="Shows the WhatsApp button in Help." error={errors.supportWhatsApp?.message} checked={field.value} onChange={field.onChange} />} />
        </div>
      </section>
      <section className="form-card"><h2>Support hours</h2>
        <div className="product-grid">
          <FormField label="Hours (English)" error={errors.supportHoursEn?.message}><Input {...register('supportHoursEn')} autoComplete="off" /></FormField>
          <FormField label="Hours (Gujarati)" error={errors.supportHoursGu?.message}><Input {...register('supportHoursGu')} autoComplete="off" /></FormField>
          <FormField label="After-hours message (English)" error={errors.afterHoursMessageEn?.message} helper="Shown when someone contacts support outside these hours."><Textarea {...register('afterHoursMessageEn')} rows={2} maxLength={160} /></FormField>
          <FormField label="After-hours message (Gujarati)" error={errors.afterHoursMessageGu?.message}><Textarea {...register('afterHoursMessageGu')} rows={2} maxLength={160} /></FormField>
        </div>
      </section>
      </TabsContent>
      <TabsContent value="delivery" className="settings-tab">
      <section className="form-card"><h2>Delivery promise</h2>
        <div className="product-grid">
          <FormField label="Promise line (English)" error={errors.deliveryPromiseEn?.message} helper="Shown on the home and onboarding screens."><Input {...register('deliveryPromiseEn')} autoComplete="off" /></FormField>
          <FormField label="Promise line (Gujarati)" error={errors.deliveryPromiseGu?.message}><Input {...register('deliveryPromiseGu')} autoComplete="off" /></FormField>
        </div>
      </section>
      </TabsContent>
      <TabsContent value="features" className="settings-tab">
      <section className="form-card"><h2>Features</h2>
        <p className="product-hint">Turn parts of the app on or off without an update. These only show or hide what the installed app already has.</p>
        <div className="switch-list">{FEATURE_FLAG_KEYS.map(key => <Controller key={key} control={control} name={`flags.${key}`} render={({ field }) => <SwitchRow id={`flag-${key}`} label={FEATURE_FLAG_LABELS[key].label} detail={FEATURE_FLAG_LABELS[key].detail} checked={field.value} onChange={field.onChange} />} />)}</div>
      </section>
      </TabsContent>
      <TabsContent value="availability" className="settings-tab">
      <section className="form-card"><h2>App availability</h2>
        <div className="product-grid">
          <FormField label="Minimum app version" error={errors.minimumAppVersion?.message} helper="Older versions are asked to update before they can continue."><Input {...register('minimumAppVersion')} autoComplete="off" placeholder="1.0.0" /></FormField>
        </div>
        <div className="switch-list">
          <Controller control={control} name="maintenanceMode" render={({ field }) => <SwitchRow id="maintenance-mode" label="Maintenance mode" detail="Customers see the message below instead of the app." checked={field.value} onChange={field.onChange} />} />
        </div>
        {maintenanceMode && <p className="warning-note" role="status"><TriangleAlert size={15} aria-hidden="true" /> Saving this turns the customer app off for everyone until you switch it back.</p>}
        <div className="product-grid">
          <FormField label="Message (English)" error={errors.maintenanceMessageEn?.message}><Textarea {...register('maintenanceMessageEn')} rows={2} maxLength={200} placeholder="We’ll be back shortly." /></FormField>
          <FormField label="Message (Gujarati)" error={errors.maintenanceMessageGu?.message}><Textarea {...register('maintenanceMessageGu')} rows={2} maxLength={200} /></FormField>
        </div>
        <div className="switch-list">
          <Controller control={control} name="showMaintenanceContact" render={({ field }) => <SwitchRow id="maintenance-contact" label="Show support contact on the maintenance screen" error={errors.showMaintenanceContact?.message} checked={field.value} onChange={field.onChange} />} />
        </div>
      </section>
      </TabsContent>
      </Tabs>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions"><Button type="button" variant="outline" className="secondary-button" disabled={!isDirty} onClick={() => reset(toForm(saved))}>Discard changes</Button><Button type="submit" className="primary-button" disabled={!isDirty || isSubmitting}>Save Settings</Button></div>
    </form>
  </div>
}

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; settings: AppSettings }

/** Loads the saved settings from the backend, then shows the form. */
export function AppSettingsWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  // Bumping this reloads from the backend; the effect ignores an answer that arrives after a newer request.
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    let cancelled = false
    appSettingsApi.get().then(
      settings => { if (!cancelled) setState({ status: 'ready', settings }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>App settings could not be loaded</strong><span>{state.message}</span><Button className="secondary-button" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>Try again</Button></div>
  return <AppSettingsForm initial={state.settings} />
}
