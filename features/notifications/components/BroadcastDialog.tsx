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
import { t } from '../messages'

const audienceOptions = (): Array<{ value: AudienceType; label: string }> => [
  { value: 'all', label: t('audienceAll') },
  { value: 'filter', label: t('audienceGroup') },
  { value: 'customers', label: t('audienceChosen') },
]
const typeOptions = () => [{ value: 'any', label: t('anyCustomer') }, { value: 'prepaid', label: t('prepaidCustomers') }, { value: 'credit', label: t('creditCustomers') }]
const subscriptionOptions = (): Array<{ value: SubscriptionFilter; label: string }> => [
  { value: 'any', label: t('anySubscription') }, { value: 'with', label: t('withSubscription') }, { value: 'without', label: t('withoutSubscription') },
]

const reachText = (reach: AudienceReach) => t(reach.customers === 1 ? 'reachOne' : 'reachMany', { count: reach.customers, devices: reach.withDevices })

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
      toast.success(t(broadcast.recipients === 1 ? 'sentToOne' : 'sentToMany', { count: broadcast.recipients }))
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
          <DialogHeader><DialogTitle>{t(count === 1 ? 'confirmOne' : 'confirmMany', { count: count ?? t('these') })}</DialogTitle><DialogDescription>{t('goesOut', { title: pending.title })}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="secondary-button" disabled={sending} onClick={() => setPending(null)}>{t('goBack')}</Button>
            <Button type="button" className="primary-button" disabled={sending} onClick={() => void send()}>{sending ? t('sending') : t('sendNow')}</Button>
          </DialogFooter>
        </div> : <form onSubmit={review} noValidate>
          <DialogHeader><DialogTitle>{t('newTitle')}</DialogTitle><DialogDescription>{t('newDescription')}</DialogDescription></DialogHeader>
          <div className="record-editor-fields two-column">
            <FormField label={t('title')} required error={errors.title?.message}><Input {...register('title')} autoComplete="off" maxLength={TITLE_MAX} /></FormField>
            <FormField label={t('gujaratiTitle')} helper={t('gujaratiTitleHelper')} error={errors.titleGujarati?.message}><Input {...register('titleGujarati')} autoComplete="off" maxLength={TITLE_MAX} lang="gu" /></FormField>
            <FormField label={t('messageField')} required error={errors.body?.message}><Textarea {...register('body')} rows={3} maxLength={BODY_MAX} /></FormField>
            <FormField label={t('gujaratiMessage')} helper={t('gujaratiMessageHelper')} error={errors.bodyGujarati?.message}><Textarea {...register('bodyGujarati')} rows={3} maxLength={BODY_MAX} lang="gu" /></FormField>
            <label className="field-wide" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" {...register('opensOffers')} /> <span>{t('opensOffers')}</span></label>
            <div className="field-wide"><FormField label={t('sendTo')}><Controller control={control} name="audienceType" render={({ field }) => <SelectField label={t('sendTo')} placeholder={t('chooseWho')} value={field.value} options={audienceOptions()} onChange={value => field.onChange(value)} />} /></FormField></div>
            {audienceType === 'filter' && <>
              <FormField label={t('customerType')} error={errors.customerType?.message}><Controller control={control} name="customerType" render={({ field }) => <SelectField label={t('customerType')} placeholder={t('anyCustomer')} value={field.value || 'any'} options={typeOptions()} onChange={value => field.onChange(value === 'any' ? '' : value)} />} /></FormField>
              <FormField label={t('subscription')}><Controller control={control} name="subscription" render={({ field }) => <SelectField label={t('subscription')} placeholder={t('withOrWithout')} value={field.value} options={subscriptionOptions()} onChange={value => field.onChange(value)} />} /></FormField>
              <div className="field-wide"><FormField label={t('pinCodes')} helper={t('pinHelper')} error={errors.pinCodes?.message}><Input {...register('pinCodes')} autoComplete="off" placeholder="382010, 382011" /></FormField></div>
            </>}
            {audienceType === 'customers' && <div className="field-wide"><FormField label={t('customers')} error={errors.customerIds?.message}><CustomerPicker selected={chosen} onChange={pickCustomers} /></FormField></div>}
            <p className="field-wide help-text" aria-live="polite">
              {reach.status === 'idle' && audienceType !== 'all' ? t('chooseWhoCount') : null}
              {reach.status === 'loading' ? t('counting') : null}
              {reach.status === 'ready' ? reachText(reach.value) : null}
              {reach.status === 'error' ? reach.message : null}
            </p>
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" className="secondary-button" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit" className="primary-button" disabled={count === 0 || reach.status === 'loading'}>{t('sendMessageButton')}</Button>
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </>
}
