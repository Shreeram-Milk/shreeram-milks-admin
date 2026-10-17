'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/select-field'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { describeApiError } from '@/lib/api-errors'
import type { CustomerRecord } from '../../customers/api'
import { notificationApi, type AudienceReach, type BroadcastRecord } from '../api'
import { BODY_MAX, TITLE_MAX, blankBroadcast, broadcastSchema, readyAudience, toAudience, type AudienceType, type BroadcastFormValues, type SubscriptionFilter } from '../schema'
import { CustomerPicker } from './CustomerPicker'

const AUDIENCE_OPTIONS: Array<{ value: AudienceType; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'filter', label: 'A group (by type, area or subscription)' },
  { value: 'customers', label: 'Customers I choose' },
]
const TYPE_OPTIONS = [{ value: 'any', label: 'Any customer' }, { value: 'prepaid', label: 'Prepaid customers' }, { value: 'credit', label: 'Credit customers' }]
const SUBSCRIPTION_OPTIONS: Array<{ value: SubscriptionFilter; label: string }> = [
  { value: 'any', label: 'With or without a subscription' }, { value: 'with', label: 'With a running subscription or trial' }, { value: 'without', label: 'Without a running subscription or trial' },
]

const reachText = (reach: AudienceReach) => `Reaches ${reach.customers} ${reach.customers === 1 ? 'customer' : 'customers'}. ${reach.withDevices} of them will get a notification on their phone; everyone sees it in the bell inside the app.`

/**
 * Writes a message and sends it at once to everyone, to a group, or to customers picked one by one. The number of people it reaches is
 * shown before sending, and sending asks once, because it cannot be taken back. The question is shown inside the same window (not as
 * a second pop-up), so the window cannot block its buttons.
 */
export function BroadcastDialog({ onClose, onSent }: { onClose: () => void; onSent: (broadcast: BroadcastRecord) => void }) {
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<BroadcastFormValues>({ resolver: zodResolver(broadcastSchema), defaultValues: blankBroadcast })
  const [audienceType, customerType, pinCodes, subscription, customerIds] = useWatch({ control, name: ['audienceType', 'customerType', 'pinCodes', 'subscription', 'customerIds'] })
  const [chosen, setChosen] = useState<CustomerRecord[]>([])
  // The answer for one particular group; it only counts while the group on screen is still that one.
  const [answer, setAnswer] = useState<{ key: string; result: { status: 'ready'; value: AudienceReach } | { status: 'error'; message: string } } | null>(null)
  const [pending, setPending] = useState<BroadcastFormValues | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // How many people the group reaches right now: asked once the group is complete, and again (after a short pause) when it changes.
  const audience = readyAudience({ audienceType, customerType, pinCodes, subscription, customerIds })
  const audienceKey = audience ? JSON.stringify(audience) : ''
  useEffect(() => {
    if (!audienceKey) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      notificationApi.audienceReach(JSON.parse(audienceKey)).then(
        value => { if (!cancelled) setAnswer({ key: audienceKey, result: { status: 'ready', value } }) },
        failure => { if (!cancelled) setAnswer({ key: audienceKey, result: { status: 'error', message: describeApiError(failure) } }) },
      )
    }, 400)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [audienceKey])
  const reach: { status: 'idle' } | { status: 'loading' } | { status: 'ready'; value: AudienceReach } | { status: 'error'; message: string } =
    !audienceKey ? { status: 'idle' } : answer?.key === audienceKey ? answer.result : { status: 'loading' }

  const pickCustomers = (customers: CustomerRecord[]) => { setChosen(customers); setValue('customerIds', customers.map(customer => customer.id), { shouldValidate: true }) }
  const review = handleSubmit(values => { setError(''); setPending(values) })
  const send = async () => {
    if (!pending) return
    setSending(true)
    try {
      const broadcast = await notificationApi.send({ title: pending.title, titleGujarati: pending.titleGujarati, body: pending.body, bodyGujarati: pending.bodyGujarati, audience: toAudience(pending), opensOffers: pending.opensOffers })
      toast.success(`Sent to ${broadcast.recipients} ${broadcast.recipients === 1 ? 'customer' : 'customers'}.`)
      onSent(broadcast)
      onClose()
    } catch (failure) {
      setError(describeApiError(failure))
      setPending(null)
    } finally {
      setSending(false)
    }
  }
  const count = reach.status === 'ready' ? reach.value.customers : null
  return <>
    <Dialog open onOpenChange={next => { if (!next && !pending && !sending) onClose() }}>
      <DialogContent className="record-editor-dialog wide">
        {pending ? <div role="alertdialog" aria-live="polite">
          <DialogHeader><DialogTitle>Send to {count ?? 'these'} {count === 1 ? 'customer' : 'customers'} now?</DialogTitle><DialogDescription>“{pending.title}” goes out immediately and cannot be taken back.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="secondary-button" disabled={sending} onClick={() => setPending(null)}>Go back</Button>
            <Button type="button" className="primary-button" disabled={sending} onClick={() => void send()}>{sending ? 'Sending...' : 'Send now'}</Button>
          </DialogFooter>
        </div> : <form onSubmit={review} noValidate>
          <DialogHeader><DialogTitle>New message to customers</DialogTitle><DialogDescription>It goes out right away. Customers on Gujarati see the Gujarati words, and everyone else sees the English words.</DialogDescription></DialogHeader>
          <div className="record-editor-fields two-column">
            <FormField label="Title" required error={errors.title?.message}><Input {...register('title')} autoComplete="off" maxLength={TITLE_MAX} /></FormField>
            <FormField label="Gujarati title" helper="Leave empty to use the English title." error={errors.titleGujarati?.message}><Input {...register('titleGujarati')} autoComplete="off" maxLength={TITLE_MAX} lang="gu" /></FormField>
            <FormField label="Message" required error={errors.body?.message}><Textarea {...register('body')} rows={3} maxLength={BODY_MAX} /></FormField>
            <FormField label="Gujarati message" helper="Leave empty to use the English message." error={errors.bodyGujarati?.message}><Textarea {...register('bodyGujarati')} rows={3} maxLength={BODY_MAX} lang="gu" /></FormField>
            <label className="field-wide" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" {...register('opensOffers')} /> <span>Open the Offers page when the customer taps this message</span></label>
            <div className="field-wide"><FormField label="Send to"><Controller control={control} name="audienceType" render={({ field }) => <SelectField label="Send to" placeholder="Choose who gets it" value={field.value} options={AUDIENCE_OPTIONS} onChange={value => field.onChange(value)} />} /></FormField></div>
            {audienceType === 'filter' && <>
              <FormField label="Customer type" error={errors.customerType?.message}><Controller control={control} name="customerType" render={({ field }) => <SelectField label="Customer type" placeholder="Any customer" value={field.value || 'any'} options={TYPE_OPTIONS} onChange={value => field.onChange(value === 'any' ? '' : value)} />} /></FormField>
              <FormField label="Subscription"><Controller control={control} name="subscription" render={({ field }) => <SelectField label="Subscription" placeholder="With or without" value={field.value} options={SUBSCRIPTION_OPTIONS} onChange={value => field.onChange(value)} />} /></FormField>
              <div className="field-wide"><FormField label="PIN codes" helper="Optional. Customers with a saved address in any of these PIN codes. Separate with commas or spaces." error={errors.pinCodes?.message}><Input {...register('pinCodes')} autoComplete="off" placeholder="382010, 382011" /></FormField></div>
            </>}
            {audienceType === 'customers' && <div className="field-wide"><FormField label="Customers" error={errors.customerIds?.message}><CustomerPicker selected={chosen} onChange={pickCustomers} /></FormField></div>}
            <p className="field-wide help-text" aria-live="polite">
              {reach.status === 'idle' && audienceType !== 'all' ? 'Choose who it goes to and the number of people shows here.' : null}
              {reach.status === 'loading' ? 'Counting...' : null}
              {reach.status === 'ready' ? reachText(reach.value) : null}
              {reach.status === 'error' ? reach.message : null}
            </p>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="secondary-button" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="primary-button" disabled={count === 0 || reach.status === 'loading'}>Send message</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>
}
