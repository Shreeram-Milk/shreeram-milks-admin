'use client'

import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { CustomerPicker } from '../../customers/components/CustomerPicker'
import { customerService } from '../../customers/service'
import { newTicketSchema, type NewTicketFormValues } from '../schema'
import { supportTicketService } from '../service'
import { TICKET_CATEGORY_LABELS, type TicketCategory } from '../types'

const CATEGORIES = (Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]).map(value => ({ value, label: TICKET_CATEGORY_LABELS[value] }))
const NO_ORDER = '__none__'

/** For issues that arrive by phone or WhatsApp rather than through the app. */
export function NewTicketDialog({ presetCustomerId, onClose, onCreated }: { presetCustomerId?: string; onClose: () => void; onCreated: (ticketId: string) => void }) {
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<NewTicketFormValues>({ resolver: zodResolver(newTicketSchema), defaultValues: { customerId: presetCustomerId ?? '', orderId: '', category: 'delivery_missing', description: '' } })
  const customerId = useWatch({ control, name: 'customerId' })
  const customer = customerId ? customerService.getById(customerId) : undefined
  const orders = useMemo(() => customerId ? supportTicketService.ordersForCustomer(customerId) : [], [customerId])
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      const ticket = supportTicketService.create(values)
      toast.success(`${ticket.ticketNumber} created.`)
      onClose()
      onCreated(ticket.id)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to create the ticket.')
    }
  })
  return <Dialog open onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="record-editor-dialog wide">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Log a ticket</DialogTitle><DialogDescription>Record an issue a customer reported outside the app.</DialogDescription></DialogHeader>
        <div className="record-editor-fields">
          <CustomerPicker customer={customer} locked={Boolean(presetCustomerId)} error={errors.customerId?.message} onSelect={picked => setValue('customerId', picked.id, { shouldValidate: true })} onClear={() => { setValue('customerId', ''); setValue('orderId', '') }} />
          <div className="record-editor-fields two-column">
            <FormField label="Category"><Controller control={control} name="category" render={({ field }) => <SelectField label="Category" placeholder="Choose a category" value={field.value} options={CATEGORIES} onChange={field.onChange} />} /></FormField>
            <FormField label="Order" helper="Optional. Only this customer’s orders are listed."><Controller control={control} name="orderId" render={({ field }) => <SelectField label="Order" placeholder={customerId ? 'No specific order' : 'Choose a customer first'} value={field.value || NO_ORDER} options={[{ value: NO_ORDER, label: 'No specific order' }, ...orders]} onChange={value => field.onChange(value === NO_ORDER ? '' : value)} />} /></FormField>
          </div>
          <FormField label="What happened?" required error={errors.description?.message}><Textarea {...register('description')} rows={4} maxLength={1000} /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Create Ticket</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
