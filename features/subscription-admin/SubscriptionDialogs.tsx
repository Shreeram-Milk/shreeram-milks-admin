'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { addDays, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import type { DayLine, SubscriptionDetail } from './api'
import { t } from './messages'

type DialogProps = { busy: boolean; onClose: () => void }

export function PauseDialog({ busy, onClose, onSave }: DialogProps & { onSave: (fromDate: string, untilDate: string | null) => void }) {
  const tomorrow = addDays(todayInBusinessZone(), 1)
  const [fromDate, setFromDate] = useState(tomorrow)
  const [untilDate, setUntilDate] = useState('')
  const invalid = untilDate !== '' && untilDate < fromDate
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{t('pauseEyebrow')}</p>
        <AlertDialogTitle>{t('pauseTitle')}</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>{t('pauseBody')}</p>
          <label className="product-form-label" htmlFor="pause-from">{t('firstDayWithout')}</label>
          <DatePickerField id="pause-from" label={t('firstDayWithout')} value={fromDate} minDate={todayInBusinessZone()} onChange={setFromDate} />
          <label className="product-form-label" htmlFor="pause-until">{t('lastDayWithout')}</label>
          <DatePickerField id="pause-until" label={t('lastDayWithoutLabel')} value={untilDate} minDate={fromDate} onChange={setUntilDate} placeholder={t('untilResumedPlaceholder')} invalid={invalid} />
          {untilDate ? <Button className="secondary-button" variant="outline" onClick={() => setUntilDate('')}>{t('noEndDate')}</Button> : null}
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('keepDelivering')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy || invalid || !fromDate} onClick={event => { event.preventDefault(); onSave(fromDate, untilDate || null) }}>{busy ? t('saving') : t('pause')}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

export function ResumeDialog({ busy, onClose, onSave }: DialogProps & { onSave: (fromDate: string) => void }) {
  const [fromDate, setFromDate] = useState(addDays(todayInBusinessZone(), 1))
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{t('resumeEyebrow')}</p>
        <AlertDialogTitle>{t('resumeTitle')}</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>{t('resumeBody')}</p>
          <label className="product-form-label" htmlFor="resume-from">{t('firstDeliveryDay')}</label>
          <DatePickerField id="resume-from" label={t('firstDeliveryDay')} value={fromDate} minDate={todayInBusinessZone()} onChange={setFromDate} />
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('stayPaused')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy || !fromDate} onClick={event => { event.preventDefault(); onSave(fromDate) }}>{busy ? t('saving') : t('resume')}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

export function CancelDialog({ subscription, busy, onClose, onSave }: DialogProps & { subscription: SubscriptionDetail; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const left = subscription.lines.reduce((sum, line) => sum + line.remaining * line.quantity, 0)
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{t('cancelEyebrow')}</p>
        <AlertDialogTitle>{t('cancelTitle', { kind: subscription.kind === 'trial' ? t('trial').toLowerCase() : t('subscription').toLowerCase(), name: subscription.customerName.trim() || t('thisCustomer') })}</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>{t('cancelBody')}{subscription.paymentMethod === 'online'
            ? t('cancelOnline', { count: left, price: formatINR(subscription.unitPricePaise) })
            : t('cancelCredit')}</p>
          <label className="product-form-label" htmlFor="cancel-reason">{t('reasonOptional')}</label>
          <Textarea id="cancel-reason" rows={3} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('keepIt')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={event => { event.preventDefault(); onSave(reason.trim()) }}>{busy ? t('cancelling') : t('cancelIt')}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

/** Confirms skipping one day and window, or bringing a skipped one back. */
export function SkipDialog({ day, busy, onClose, onConfirm }: DialogProps & { day: DayLine & { date: string }; onConfirm: () => void }) {
  const undo = day.state === 'skipped'
  const which = { day: formatWeekdayDate(day.date), slot: day.slotName, quantity: day.quantity }
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{undo ? t('bringBack') : t('skip')}</p>
        <AlertDialogTitle>{undo ? t('bringBackTitle', which) : t('skipTitle', which)}</AlertDialogTitle>
        <AlertDialogDescription>{undo
          ? t('bringBackBody')
          : t('skipBody', { order: day.orderNumber ? t('orderCancelled', { number: day.orderNumber }) : '' })}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>{t('keepAsIs')}</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy} onClick={event => { event.preventDefault(); onConfirm() }}>{busy ? t('saving') : undo ? t('bringItBack') : t('skipIt')}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
