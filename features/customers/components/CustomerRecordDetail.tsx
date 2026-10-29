'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/select-field'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/configuration/FormField'
import { DetailRows } from '@/components/shared/DetailRows'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { tc } from '@/lib/i18n/common'
import { liveLabels } from '@/lib/i18n/core'
import { t } from '../messages'
import { formatTimestamp } from '@/lib/business-time'
import { useLoaded } from '../../configuration/use-loaded'
import { customerRecordApi, type CustomerRecord } from '../api'
import { CustomerAddressesCard } from './CustomerAddressesCard'
import { CUSTOMER_RECORD_STATUS_LABELS, CUSTOMER_RECORD_TYPE_LABELS, customerDisplayName, customerRecordSchema, formatCustomerPhone, isCustomerId, type CustomerRecordFormValues } from '../record-schema'

const LANGUAGES = liveLabels(t, { en: 'english', gu: 'gujarati' })
const typeOptions = () => Object.entries(CUSTOMER_RECORD_TYPE_LABELS).map(([value, label]) => ({ value, label }))

/** Mounted fresh for each customer, so the form always starts from the saved record. The server checks every save again. */
function CustomerRecordForm({ customer, onSaved }: { customer: CustomerRecord; onSaved: (saved: CustomerRecord) => void }) {
  const editable = customer.status !== 'deleted'
  const { register, control, watch, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<CustomerRecordFormValues>({
    resolver: zodResolver(customerRecordSchema),
    defaultValues: { name: customer.name, customerType: customer.customerType, adminNote: customer.adminNote },
  })
  const [error, setError] = useState('')

  const save = async (values: CustomerRecordFormValues) => {
    setError('')
    try {
      const saved = await customerRecordApi.update(customer.id, values)
      toast.success(t('saved'))
      onSaved(saved)
    } catch (failure) {
      setError(describeApiError(failure))
    }
  }
  const submit = handleSubmit(save)

  return <>
    <form className="form-card" onSubmit={submit} noValidate aria-label={t('account')}>
      <div className="form-section-header"><div className="form-section-heading"><div><h2>{t('account')}</h2><p>{editable ? t('accountEditable') : t('accountDeleted')}</p></div></div></div>
      <div className="record-editor-fields">
        <FormField label={t('name')} error={errors.name?.message}><Input {...register('name')} autoComplete="off" disabled={!editable} /></FormField>
        <FormField label={t('customerType')} helper={watch("customerType") === "credit" ? t('creditHelper') : t('prepaidHelper')} error={errors.customerType?.message}>
          <Controller control={control} name="customerType" render={({ field }) => <SelectField label={t('customerType')} value={field.value} onChange={field.onChange} placeholder={t('selectAType')} options={typeOptions()} />} />
        </FormField>
        <FormField label={t('staffNote')} className="field-wide" helper={t('staffNoteHelper')} error={errors.adminNote?.message}><Textarea {...register('adminNote')} rows={3} maxLength={500} disabled={!editable} /></FormField>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {editable && <div className="form-actions"><Button type="submit" className="primary-button" disabled={isSubmitting || !isDirty}>{isSubmitting ? tc('saving') : tc('saveChanges')}</Button></div>}
    </form>
  </>
}

/** One customer: their sign-up details (read-only) and the account settings staff may change. */
export function CustomerRecordDetail({ id }: { id: string }) {
  const { state, reload } = useLoaded(() => customerRecordApi.get(id), id)
  if (!isCustomerId(id)) return <div className="product-state"><strong>{t('sampleTitle')}</strong><span>{t('sampleDetail')}</span><Link className="secondary-button" href="/customers">{t('backToCustomers')}</Link></div>
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('customerFailed')}</strong><span>{state.message}</span><div className="setup-actions"><Button className="secondary-button" variant="outline" onClick={reload}>{tc('tryAgain')}</Button><Link className="secondary-button" href="/customers">{t('backToCustomers')}</Link></div></div>

  const customer = state.data
  return <div className="workspace-page product-detail-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link href="/customers" className="title-back-button" aria-label={t('backToCustomers')}><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: t('manage') }, { label: t('customers'), href: '/customers' }, { label: customerDisplayName(customer) }]} /><h1>{customerDisplayName(customer)}</h1><p className="page-description">{customer.email || formatCustomerPhone(customer.phone)}</p></div>
      </div>
      <div className="header-actions"><StatusBadge status={customer.status === 'deleted' ? 'cancelled' : 'active'}>{CUSTOMER_RECORD_STATUS_LABELS[customer.status]}</StatusBadge></div>
    </header>
    <section className="form-card" aria-labelledby="customer-signup-title">
      <div className="form-section-header"><div className="form-section-heading"><div><h2 id="customer-signup-title">{t('signupTitle')}</h2><p>{t('signupIntro')}</p></div></div></div>
      <DetailRows rows={[
        { label: t('emailSignIn'), value: customer.email || '—' },
        { label: t('phoneOptional'), value: formatCustomerPhone(customer.phone) },
        { label: t('appLanguage'), value: LANGUAGES[customer.language] },
        { label: t('joined'), value: formatTimestamp(customer.createdAt) },
        { label: t('lastSignIn'), value: customer.lastSignInAt ? formatTimestamp(customer.lastSignInAt) : t('never') },
      ]} />
    </section>
    <CustomerAddressesCard customerId={customer.id} />
    <CustomerRecordForm key={customer.updatedAt} customer={customer} onSaved={reload} />
  </div>
}
