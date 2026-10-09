'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormSelect } from '@/components/shared/FormSelect'
import { FormField } from '@/components/configuration/FormField'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { getPrimaryAddress } from '../address'
import { customerSchema, type CustomerFormValues } from '../schema'
import { customerService } from '../service'
import type { Customer } from '../types'

const emptyValues: CustomerFormValues = { fullName: '', mobile: '', email: '', status: 'active', customerType: 'prepaid', line1: '', line2: '', locality: '', city: '', state: '', pinCode: '', notes: '' }

function toFormValues(customer: Customer): CustomerFormValues {
  const address = getPrimaryAddress(customer)
  return { fullName: customer.fullName, mobile: customer.mobile, email: customer.email, status: customer.status, customerType: customer.customerType, line1: address?.line1 ?? '', line2: address?.line2 ?? '', locality: address?.locality ?? '', city: address?.city ?? '', state: address?.state ?? '', pinCode: address?.pinCode ?? '', notes: customer.notes }
}

export function CustomerForm({ id }: { id?: string }) {
  const router = useRouter()
  const existing = id ? customerService.getById(id) : undefined
  const [submitError, setSubmitError] = useState('')
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<CustomerFormValues>({ resolver: zodResolver(customerSchema), defaultValues: existing ? toFormValues(existing) : emptyValues })
  const backPath = id ? `/customers/${id}` : '/customers'
  const { leave, dialog } = useUnsavedChangesGuard(isDirty, backPath)

  if (id && !existing) return <div className="product-state"><strong>Customer not found</strong><Link className="secondary-button" href="/customers">Back to customers</Link></div>

  const save = handleSubmit(values => {
    setSubmitError('')
    try {
      const saved = id ? customerService.update(id, values) : customerService.create(values)
      toast.success(id ? 'Customer updated.' : 'Customer created.')
      router.push(`/customers/${saved.id}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save customer.')
    }
  })

  const invalid = (name: keyof CustomerFormValues) => errors[name] ? true : undefined
  return <div className="workspace-page products-page product-edit-page">
    <header className="page-header page-header-form"><div className="page-title-row">
      <Button variant="outline" className="title-back-button" type="button" aria-label="Back" onClick={() => leave()}><ArrowLeft size={19} /></Button>
      <div><PageBreadcrumbs items={[{ label: 'Customers', href: '/customers' }, ...(existing ? [{ label: existing.fullName, href: `/customers/${existing.id}` }] : []), { label: existing ? 'Edit' : 'New customer' }]} /><h1>{existing ? `Edit ${existing.fullName}` : 'Add Customer'}</h1><p className="page-description">{existing ? 'Update the customer profile and delivery address.' : 'Create a customer profile with a delivery address.'}</p></div>
    </div></header>
    <form className="product-form" onSubmit={save} noValidate>
      <div className="product-form-scroll">
        <section className="form-card">
          <div className="form-section-header"><div className="form-section-heading"><span>01</span><div><h2>Profile</h2><p>Contact details and the account model for this customer.</p></div></div></div>
          <div className="product-grid">
            <FormField label="Full name" required error={errors.fullName?.message}><Input {...register('fullName')} autoComplete="off" aria-invalid={invalid('fullName')} placeholder="Rakesh Patel" /></FormField>
            <FormField label="Mobile number" required error={errors.mobile?.message} helper="10-digit Indian mobile number."><Input {...register('mobile')} inputMode="numeric" maxLength={10} autoComplete="off" aria-invalid={invalid('mobile')} placeholder="9876543210" /></FormField>
            <FormField label="Email" error={errors.email?.message}><Input {...register('email')} type="email" autoComplete="off" aria-invalid={invalid('email')} placeholder="Optional" /></FormField>
            <FormField label="Customer type" required error={errors.customerType?.message} helper="Indicates the account model only. Credit accounting arrives in a later phase."><FormSelect control={control} name="customerType" label="Customer type" placeholder="Select customer type" options={[{ value: 'prepaid', label: 'Prepaid' }, { value: 'credit', label: 'Credit' }]} /></FormField>
            <FormField label="Status"><FormSelect control={control} name="status" label="Status" placeholder="Select status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></FormField>
          </div>
        </section>
        <section className="form-card">
          <div className="form-section-header"><div className="form-section-heading"><span>02</span><div><h2>Delivery address</h2><p>The PIN code decides which products and delivery slots are available.</p></div></div></div>
          <div className="product-grid">
            <FormField label="Address line 1" required error={errors.line1?.message}><Input {...register('line1')} autoComplete="off" aria-invalid={invalid('line1')} /></FormField>
            <FormField label="Address line 2" error={errors.line2?.message}><Input {...register('line2')} autoComplete="off" placeholder="Optional" /></FormField>
            <FormField label="Area / locality" required error={errors.locality?.message}><Input {...register('locality')} autoComplete="off" aria-invalid={invalid('locality')} placeholder="Sector 10" /></FormField>
            <FormField label="City" required error={errors.city?.message}><Input {...register('city')} autoComplete="off" aria-invalid={invalid('city')} placeholder="Gandhinagar" /></FormField>
            <FormField label="State" required error={errors.state?.message}><Input {...register('state')} autoComplete="off" aria-invalid={invalid('state')} placeholder="Gujarat" /></FormField>
            <FormField label="PIN code" required error={errors.pinCode?.message}><Input {...register('pinCode')} inputMode="numeric" maxLength={6} autoComplete="off" aria-invalid={invalid('pinCode')} placeholder="382010" /></FormField>
          </div>
        </section>
        <section className="form-card">
          <div className="form-section-header"><div className="form-section-heading"><span>03</span><div><h2>Notes</h2><p>Internal notes, not shown to the customer.</p></div></div></div>
          <FormField label="Notes" error={errors.notes?.message}><Textarea {...register('notes')} rows={3} placeholder="Optional" /></FormField>
        </section>
        {submitError && <p className="field-error" role="alert">{submitError}</p>}
      </div>
      <div className="product-save-bar">
        <span>{existing ? 'Editing customer' : 'New customer'}</span>
        <div className="product-step-actions">
          <Button type="button" variant="outline" className="secondary-button" onClick={() => leave()}>Cancel</Button>
          <Button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : existing ? 'Save Changes' : 'Create Customer'}</Button>
        </div>
      </div>
    </form>
    {dialog}
  </div>
}
