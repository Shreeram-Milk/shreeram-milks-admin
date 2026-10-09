'use client'

import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { OptionalDateField } from '@/components/shared/OptionalDateField'
import { paiseToRupeeInput, parseRupeesToPaise } from '@/lib/money'
import { offerSchema, type OfferFormValues } from '../schema'
import { offerService } from '../service'
import { OFFER_APPLIES_TO_LABELS, type Offer, type OfferAppliesTo } from '../types'

const TYPES = [{ value: 'percent', label: 'Percentage off' }, { value: 'flat', label: 'Fixed amount off (₹)' }]
const APPLIES_TO = (Object.keys(OFFER_APPLIES_TO_LABELS) as OfferAppliesTo[]).map(value => ({ value, label: OFFER_APPLIES_TO_LABELS[value] }))

const blank: OfferFormValues = { name: '', nameGujarati: '', description: '', code: '', discountType: 'percent', value: '', minOrder: '', appliesTo: 'all_orders', startDate: '', endDate: '', status: 'active' }
const fromOffer = (offer: Offer): OfferFormValues => ({
  name: offer.name, nameGujarati: offer.nameGujarati, description: offer.description, code: offer.code, discountType: offer.discountType,
  value: offer.discountType === 'percent' ? String(offer.value) : paiseToRupeeInput(offer.value),
  minOrder: offer.minOrderPaise ? paiseToRupeeInput(offer.minOrderPaise) : '',
  appliesTo: offer.appliesTo, startDate: offer.startDate, endDate: offer.endDate, status: offer.status,
})

/** Mounted fresh for each create/edit, so the form always starts from the right record. */
export function OfferDialog({ offer, onClose, onDone }: { offer: Offer | null; onClose: () => void; onDone: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<OfferFormValues>({ resolver: zodResolver(offerSchema), defaultValues: offer ? fromOffer(offer) : blank })
  const discountType = useWatch({ control, name: 'discountType' })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      const { value, minOrder, ...rest } = values
      offerService.save({ ...rest, id: offer?.id, value: values.discountType === 'percent' ? Number(value) : parseRupeesToPaise(value) ?? 0, minOrderPaise: minOrder ? parseRupeesToPaise(minOrder) ?? 0 : 0 })
      toast.success(offer ? 'Offer saved.' : 'Offer created.')
      onClose()
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the offer.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>{offer ? 'Edit offer' : 'Add offer'}</DialogTitle><DialogDescription>Offers are shown in the customer app. The server checks every order before applying one.</DialogDescription></DialogHeader>
        <div className="record-editor-fields two-column">
          <FormField label="Offer name" required error={errors.name?.message}><Input {...register('name')} autoComplete="off" placeholder="Dawn discount" /></FormField>
          <FormField label="Gujarati name" error={errors.nameGujarati?.message}><Input {...register('nameGujarati')} autoComplete="off" /></FormField>
          <FormField label="Discount type"><Controller control={control} name="discountType" render={({ field }) => <SelectField label="Discount type" placeholder="Choose a type" value={field.value} options={TYPES} onChange={field.onChange} />} /></FormField>
          <FormField label={discountType === 'percent' ? 'Percentage' : 'Amount (₹)'} required error={errors.value?.message}><Input {...register('value')} inputMode="decimal" autoComplete="off" placeholder={discountType === 'percent' ? '10' : '50'} /></FormField>
          <FormField label="Applies to"><Controller control={control} name="appliesTo" render={({ field }) => <SelectField label="Applies to" placeholder="Choose" value={field.value} options={APPLIES_TO} onChange={field.onChange} />} /></FormField>
          <FormField label="Minimum order (₹)" error={errors.minOrder?.message} helper="Leave empty for no minimum."><Input {...register('minOrder')} inputMode="decimal" autoComplete="off" placeholder="250" /></FormField>
          <FormField label="Code" error={errors.code?.message} helper="Optional. Empty means it applies automatically." ><Input {...register('code')} autoComplete="off" placeholder="WELCOME10" /></FormField>
          <FormField label="Description" error={errors.description?.message}><Textarea {...register('description')} rows={2} maxLength={200} placeholder="Optional note for staff" /></FormField>
          <FormField label="Starts" helper="Leave empty to start straight away."><Controller control={control} name="startDate" render={({ field }) => <OptionalDateField label="Start date" value={field.value} onChange={field.onChange} placeholder="Immediately" />} /></FormField>
          <FormField label="Ends" error={errors.endDate?.message} helper="Leave empty to run until turned off."><Controller control={control} name="endDate" render={({ field }) => <OptionalDateField label="End date" value={field.value} onChange={field.onChange} placeholder="No end date" />} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>{offer ? 'Save Offer' : 'Create Offer'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
