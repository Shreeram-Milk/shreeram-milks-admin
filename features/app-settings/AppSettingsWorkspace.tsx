'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/configuration/FormField'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { formatTimestamp } from '@/lib/business-time'
import { appSettingsSchema, type AppSettingsFormValues } from './schema'
import { appSettingsService } from './service'
import type { AppSettings } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

const toForm = (settings: AppSettings): AppSettingsFormValues => ({
  supportPhone: settings.supportPhone, supportEmail: settings.supportEmail, supportHours: settings.supportHours, supportHoursGujarati: settings.supportHoursGujarati,
  deliveryPromise: settings.deliveryPromise, deliveryPromiseGujarati: settings.deliveryPromiseGujarati,
  minimumAppVersion: settings.minimumAppVersion, maintenanceMode: settings.maintenanceMode, maintenanceMessage: settings.maintenanceMessage,
})

function AppSettingsWorkspaceContent() {
  // Read once on mount; the form owns the values from then on and `saved` only tracks the last save time.
  const [saved, setSaved] = useState(() => appSettingsService.get())
  const [error, setError] = useState('')
  const { register, handleSubmit, control, reset, formState: { errors, isDirty, isSubmitting } } = useForm<AppSettingsFormValues>({ resolver: zodResolver(appSettingsSchema), defaultValues: toForm(saved) })
  const maintenanceMode = useWatch({ control, name: 'maintenanceMode' })
  const submit = handleSubmit(values => {
    setError('')
    try {
      const next = appSettingsService.save(values)
      setSaved(next)
      reset(toForm(next))
      toast.success('App settings saved.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the settings.')
    }
  })
  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Content' }, { label: 'App Settings' }]} /><h1>App Settings</h1><p className="page-description">Support details and start-up switches for the customer app. Last saved {formatTimestamp(saved.updatedAt)}.</p></div>
    </header>
    <form onSubmit={submit} noValidate className="settings-form">
      <section className="form-card"><h2>Support</h2>
        <div className="product-grid">
          <FormField label="Support phone" error={errors.supportPhone?.message} helper="Shown on Call support."><Input {...register('supportPhone')} inputMode="tel" autoComplete="off" placeholder="9876543210" /></FormField>
          <FormField label="Support email" error={errors.supportEmail?.message}><Input {...register('supportEmail')} inputMode="email" autoComplete="off" /></FormField>
          <FormField label="Support hours" error={errors.supportHours?.message}><Input {...register('supportHours')} autoComplete="off" /></FormField>
          <FormField label="Gujarati support hours" error={errors.supportHoursGujarati?.message}><Input {...register('supportHoursGujarati')} autoComplete="off" /></FormField>
        </div>
      </section>
      <section className="form-card"><h2>Delivery promise</h2>
        <div className="product-grid">
          <FormField label="Promise line" error={errors.deliveryPromise?.message} helper="Shown on the home and onboarding screens."><Input {...register('deliveryPromise')} autoComplete="off" /></FormField>
          <FormField label="Gujarati promise line" error={errors.deliveryPromiseGujarati?.message}><Input {...register('deliveryPromiseGujarati')} autoComplete="off" /></FormField>
        </div>
      </section>
      <section className="form-card"><h2>App availability</h2>
        <div className="product-grid">
          <FormField label="Minimum app version" error={errors.minimumAppVersion?.message} helper="Older versions are asked to update before they can continue."><Input {...register('minimumAppVersion')} autoComplete="off" placeholder="1.0.0" /></FormField>
          <div className="switch-field"><label htmlFor="maintenance-mode">Maintenance mode</label><Controller control={control} name="maintenanceMode" render={({ field }) => <Switch id="maintenance-mode" checked={field.value} onCheckedChange={field.onChange} />} /><small className="help-text">Customers see the message below instead of the app.</small></div>
        </div>
        {maintenanceMode && <p className="warning-note" role="status"><TriangleAlert size={15} aria-hidden="true" /> Saving this turns the customer app off for everyone until you switch it back.</p>}
        <FormField label="Maintenance message" error={errors.maintenanceMessage?.message}><Textarea {...register('maintenanceMessage')} rows={2} maxLength={200} placeholder="We’ll be back shortly." /></FormField>
      </section>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="settings-actions"><Button type="button" variant="outline" className="secondary-button" disabled={!isDirty} onClick={() => reset(toForm(saved))}>Discard changes</Button><Button type="submit" className="primary-button" disabled={!isDirty || isSubmitting}>Save Settings</Button></div>
    </form>
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function AppSettingsWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <AppSettingsWorkspaceContent /> : <PageSkeleton />
}
