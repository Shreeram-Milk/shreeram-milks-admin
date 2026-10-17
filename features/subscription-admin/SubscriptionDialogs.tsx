'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { addDays, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import type { DayLine, SubscriptionDetail } from './api'

type DialogProps = { busy: boolean; onClose: () => void }

export function PauseDialog({ busy, onClose, onSave }: DialogProps & { onSave: (fromDate: string, untilDate: string | null) => void }) {
  const tomorrow = addDays(todayInBusinessZone(), 1)
  const [fromDate, setFromDate] = useState(tomorrow)
  const [untilDate, setUntilDate] = useState('')
  const invalid = untilDate !== '' && untilDate < fromDate
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">Pause or vacation</p>
        <AlertDialogTitle>Stop deliveries for a while?</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>No deliveries from the first day. With an end date it is a vacation; without one, deliveries wait until someone presses Resume. Paused days are not lost: they move to the end. Orders already made for these days are cancelled where they can still be changed.</p>
          <label className="product-form-label" htmlFor="pause-from">First day without delivery</label>
          <DatePickerField id="pause-from" label="First day without delivery" value={fromDate} minDate={todayInBusinessZone()} onChange={setFromDate} />
          <label className="product-form-label" htmlFor="pause-until">Last day without delivery (optional)</label>
          <DatePickerField id="pause-until" label="Last day without delivery" value={untilDate} minDate={fromDate} onChange={setUntilDate} placeholder="Until resumed" invalid={invalid} />
          {untilDate ? <Button className="secondary-button" variant="outline" onClick={() => setUntilDate('')}>No end date</Button> : null}
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Keep delivering</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy || invalid || !fromDate} onClick={event => { event.preventDefault(); onSave(fromDate, untilDate || null) }}>{busy ? 'Saving…' : 'Pause'}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

export function ResumeDialog({ busy, onClose, onSave }: DialogProps & { onSave: (fromDate: string) => void }) {
  const [fromDate, setFromDate] = useState(addDays(todayInBusinessZone(), 1))
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">Resume</p>
        <AlertDialogTitle>Restart deliveries?</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>The pause ends the day before. If the date is too soon for the order-by time, you will be told the earliest possible day.</p>
          <label className="product-form-label" htmlFor="resume-from">First delivery day</label>
          <DatePickerField id="resume-from" label="First delivery day" value={fromDate} minDate={todayInBusinessZone()} onChange={setFromDate} />
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Stay paused</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy || !fromDate} onClick={event => { event.preventDefault(); onSave(fromDate) }}>{busy ? 'Saving…' : 'Resume'}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

export function CancelDialog({ subscription, busy, onClose, onSave }: DialogProps & { subscription: SubscriptionDetail; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const left = subscription.lines.reduce((sum, line) => sum + line.remaining * line.quantity, 0)
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">Cancel</p>
        <AlertDialogTitle>Cancel this {subscription.kind === 'trial' ? 'trial' : 'subscription'} for {subscription.customerName.trim() || 'this customer'}?</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>This is final. No new deliveries are made, and orders not yet locked by the order-by time are cancelled. {subscription.paymentMethod === 'online'
            ? `It was paid upfront: the value of the deliveries not used (about ${left} × ${formatINR(subscription.unitPricePaise)}) is added to Money → "Refunds to send", for you to refund in PhonePe and record.`
            : 'It is on credit, so the customer is only charged for deliveries that were made.'}</p>
          <label className="product-form-label" htmlFor="cancel-reason">Reason (optional)</label>
          <Textarea id="cancel-reason" rows={3} maxLength={300} value={reason} onChange={event => setReason(event.target.value)} />
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Keep it</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button destructive-button" disabled={busy} onClick={event => { event.preventDefault(); onSave(reason.trim()) }}>{busy ? 'Cancelling…' : 'Cancel it'}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

/** Confirms skipping one day and window, or bringing a skipped one back. */
export function SkipDialog({ day, busy, onClose, onConfirm }: DialogProps & { day: DayLine & { date: string }; onConfirm: () => void }) {
  const undo = day.state === 'skipped'
  return <AlertDialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">{undo ? 'Bring back' : 'Skip'}</p>
        <AlertDialogTitle>{undo ? 'Bring back' : 'Skip'} {formatWeekdayDate(day.date)} · {day.slotName} × {day.quantity}?</AlertDialogTitle>
        <AlertDialogDescription>{undo
          ? 'This delivery comes as planned again, and the last delivery moves one day earlier.'
          : `This delivery will not come${day.orderNumber ? ` (order ${day.orderNumber} is cancelled)` : ''}. It is added at the end, so the customer still gets every delivery bought. Nothing is refunded.`}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button" disabled={busy}>Keep as it is</Button></AlertDialogCancel><AlertDialogAction asChild><Button className="primary-button" disabled={busy} onClick={event => { event.preventDefault(); onConfirm() }}>{busy ? 'Saving…' : undo ? 'Bring it back' : 'Skip it'}</Button></AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
