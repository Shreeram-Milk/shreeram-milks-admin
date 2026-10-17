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
import { formatTimestamp } from '@/lib/business-time'
import { useLoaded } from '../../configuration/use-loaded'
import { customerRecordApi, type CustomerRecord } from '../api'
import { CustomerAddressesCard } from './CustomerAddressesCard'
import { CUSTOMER_RECORD_STATUS_LABELS, CUSTOMER_RECORD_TYPE_LABELS, customerDisplayName, customerRecordSchema, formatCustomerPhone, isCustomerId, type CustomerRecordFormValues } from '../record-schema'

const LANGUAGES = { en: 'English', gu: 'Gujarati' } as const
const TYPE_OPTIONS = Object.entries(CUSTOMER_RECORD_TYPE_LABELS).map(([value, label]) => ({ value, label }))

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
      toast.success('Customer saved.')
      onSaved(saved)
    } catch (failure) {
      setError(describeApiError(failure))
    }
  }
  const submit = handleSubmit(save)

  return <>
    <form className="form-card" onSubmit={submit} noValidate aria-label="Customer account">
      <div className="form-section-header"><div className="form-section-heading"><div><h2>Account</h2><p>{editable ? 'Correct their name, choose how they pay, or leave a note for staff.' : 'This customer deleted their account, so nothing here can be changed.'}</p></div></div></div>
      <div className="record-editor-fields">
        <FormField label="Name" error={errors.name?.message}><Input {...register('name')} autoComplete="off" disabled={!editable} /></FormField>
        <FormField label="Customer type" helper={watch("customerType") === "credit" ? "Credit customers order now and pay later, up to a limit. After saving, set their limit under Credit Accounts: until you do, their limit is ₹0 and credit orders are refused." : "Prepaid customers pay before delivery. Credit customers pay later against a limit."} error={errors.customerType?.message}>
          <Controller control={control} name="customerType" render={({ field }) => <SelectField label="Customer type" value={field.value} onChange={field.onChange} placeholder="Select a type" options={TYPE_OPTIONS} />} />
        </FormField>
        <FormField label="Note for staff" className="field-wide" helper="Only staff see this. The customer never does." error={errors.adminNote?.message}><Textarea {...register('adminNote')} rows={3} maxLength={500} disabled={!editable} /></FormField>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {editable && <div className="form-actions"><Button type="submit" className="primary-button" disabled={isSubmitting || !isDirty}>{isSubmitting ? 'Saving…' : 'Save changes'}</Button></div>}
    </form>
  </>
}

/** One customer: their sign-up details (read-only) and the account settings staff may change. */
export function CustomerRecordDetail({ id }: { id: string }) {
  const { state, reload } = useLoaded(() => customerRecordApi.get(id), id)
  if (!isCustomerId(id)) return <div className="product-state"><strong>This customer is sample data</strong><span>The page you came from is not connected to real customers yet. Real customers are listed on the Customers page.</span><Link className="secondary-button" href="/customers">Back to customers</Link></div>
  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>This customer could not be loaded</strong><span>{state.message}</span><div className="setup-actions"><Button className="secondary-button" variant="outline" onClick={reload}>Try again</Button><Link className="secondary-button" href="/customers">Back to customers</Link></div></div>

  const customer = state.data
  return <div className="workspace-page product-detail-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link href="/customers" className="title-back-button" aria-label="Back to customers"><ArrowLeft size={19} /></Link>
        <div><PageBreadcrumbs items={[{ label: 'Manage' }, { label: 'Customers', href: '/customers' }, { label: customerDisplayName(customer) }]} /><h1>{customerDisplayName(customer)}</h1><p className="page-description">{customer.email || formatCustomerPhone(customer.phone)}</p></div>
      </div>
      <div className="header-actions"><StatusBadge status={customer.status === 'deleted' ? 'cancelled' : 'active'}>{CUSTOMER_RECORD_STATUS_LABELS[customer.status]}</StatusBadge></div>
    </header>
    <section className="form-card" aria-labelledby="customer-signup-title">
      <div className="form-section-header"><div className="form-section-heading"><div><h2 id="customer-signup-title">Sign-up details</h2><p>Set by the customer in the app. Their email is how they sign in, so it cannot be changed here.</p></div></div></div>
      <DetailRows rows={[
        { label: 'Email (how they sign in)', value: customer.email || '—' },
        { label: 'Phone (optional)', value: formatCustomerPhone(customer.phone) },
        { label: 'App language', value: LANGUAGES[customer.language] },
        { label: 'Joined', value: formatTimestamp(customer.createdAt) },
        { label: 'Last sign-in', value: customer.lastSignInAt ? formatTimestamp(customer.lastSignInAt) : 'Never' },
      ]} />
    </section>
    <CustomerAddressesCard customerId={customer.id} />
    <CustomerRecordForm key={customer.updatedAt} customer={customer} onSaved={reload} />
  </div>
}
