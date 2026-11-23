'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { describeApiError } from '@/lib/api-errors'
import { formatINR } from '@/lib/money'
import { refundAdminApi, type RefundBatch, type RefundReview, type RefundSource } from './api'
import { t } from './messages'
import styles from './RefundDialog.module.css'

const verification = z.object({ password: z.string().min(1).max(200), acknowledged: z.boolean().refine(value => value) })
type Verification = z.infer<typeof verification>

/** Review is read-only. Only a separately submitted, password-verified confirmation can authorize money movement. */
export function SecureRefundDialog({ source, onClose, onDone, onCancelRequest }: {
  source: RefundSource; onClose: () => void; onDone: () => void; onCancelRequest?: () => void
}) {
  const [review, setReview] = useState<RefundReview | null>(null)
  const [batch, setBatch] = useState<RefundBatch | null>(null)
  const [step, setStep] = useState<'review' | 'verify'>('review')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const inFlight = useRef(false)
  const [attempted, setAttempted] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Verification>({ resolver: zodResolver(verification), defaultValues: { password: '', acknowledged: false } })

  useEffect(() => {
    let cancelled = false
    refundAdminApi.review({ kind: source.kind, id: source.id }).then(result => {
      if (cancelled) return
      setReview(result)
      setBatch(result.reviewToken ? null : result.plan.batch)
      setError('')
    }, failure => { if (!cancelled) setError(describeApiError(failure)) })
    return () => { cancelled = true }
  }, [source.kind, source.id, reload])

  const close = () => { reset(); if (attempted || batch) onDone(); else onClose() }
  const submit = async (event: FormEvent<HTMLFormElement>) => handleSubmit(async values => {
    if (inFlight.current || !review?.reviewToken || step !== 'verify') return
    inFlight.current = true; setAttempted(true); setBusy(true); setError('')
    try {
      const result = await refundAdminApi.confirm(source, { password: values.password, acknowledged: true, reviewToken: review.reviewToken })
      setBatch(result.batch)
    } catch (failure) { setError(describeApiError(failure)) }
    finally { reset(); setBusy(false); inFlight.current = false }
  })(event)
  const check = async () => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { setBatch((await refundAdminApi.check(source)).batch) } catch (failure) { setError(describeApiError(failure)) }
    finally { setBusy(false); inFlight.current = false }
  }
  const restart = () => { reset(); setStep('review'); setBatch(null); setReview(null); setError(''); setReload(value => value + 1) }
  const statusKey = batch?.status === 'completed' ? 'completed' : batch?.status === 'failed' ? 'failed' : 'processing'

  return <Dialog open onOpenChange={open => { if (!open && !busy) close() }}>
    <DialogContent className="record-editor-dialog wallet-refund-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onPointerDownOutside={event => { if (busy) event.preventDefault() }}>
      <DialogHeader><DialogTitle>{batch ? t(statusKey) : t('title')}</DialogTitle>
        <DialogDescription>{batch ? t(`${statusKey}Hint`) : t('description')}</DialogDescription></DialogHeader>
      {!review && !error ? <p role="status">{t('loading')}</p> : null}
      {review && <div className="record-editor-fields one-column">
        <div className="wallet-send-amount"><span>{review.plan.customerName} · {review.plan.customerContact}</span><strong>{formatINR(batch?.amountPaise ?? review.plan.amountPaise)}</strong></div>
        {batch ? <div aria-live="polite">{batch.attempts.map(attempt => <div key={attempt.id} className={styles.attempt}>
          <strong>{formatINR(attempt.amountPaise)} · {t(attempt.status === 'failed' ? 'failedPart' : attempt.status === 'completed' ? 'completedPart' : attempt.status)}</strong>
          <small>{attempt.merchantOrderId}</small><small>{t('reference')}: {attempt.providerReference || attempt.merchantRefundId}</small>
          {attempt.errorCode && <small>{attempt.errorCode}</small>}
        </div>)}</div> : <>
          <p className="eyebrow">{t(step)}</p>
          {review.plan.reason && <p>{t('reason')}: {review.plan.reason}</p>}
          <div>{review.plan.parts.map(part => <div className={styles.part} key={part.paymentId}><span>{t('original')}: {part.merchantOrderId}</span><strong>{formatINR(part.amountPaise)}</strong></div>)}</div>
          {step === 'verify' && <form id="verify-refund" onSubmit={submit} noValidate>
            <p className="product-hint">{t('verifyHint')}</p>
            <FormField label={t('password')} helper={t('passwordHint')} error={errors.password ? t('passwordRequired') : undefined}>
              <Input type="password" autoComplete="current-password" maxLength={200} disabled={busy} {...register('password')} autoFocus />
            </FormField>
            <label className="flex items-start gap-2 py-4"><input type="checkbox" disabled={busy} {...register('acknowledged')} /><span>{t('acknowledge')}</span></label>
            {errors.acknowledged && <p className="field-error" role="alert">{t('acknowledgeRequired')}</p>}
          </form>}
        </>}
      </div>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <DialogFooter className="dialog-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={close}>{t('close')}</Button>
        {!review && error && <Button type="button" variant="outline" onClick={restart}>{t('retry')}</Button>}
        {batch ? <>
          {batch.status === 'processing' && <Button type="button" className="primary-button" disabled={busy} onClick={() => void check()}>{t(busy ? 'checking' : 'check')}</Button>}
          {batch.status === 'failed' && <Button type="button" className="primary-button" disabled={busy} onClick={restart}>{t('retry')}</Button>}
        </> : review?.reviewToken ? step === 'review' ? <>
          {onCancelRequest && !review.plan.batch && <Button type="button" variant="outline" onClick={onCancelRequest}>{t('cancelRequest')}</Button>}
          <Button type="button" className="primary-button" onClick={() => { reset(); setError(''); setStep('verify') }}>{t('continue')}</Button>
        </> : <>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { reset(); setStep('review'); setError('') }}>{t('back')}</Button>
          {attempted && <Button type="button" variant="outline" disabled={busy} onClick={() => void check()}>{t('check')}</Button>}
          <Button type="submit" form="verify-refund" className="primary-button destructive-button" disabled={busy}>{busy ? t('sending') : t('send', { amount: formatINR(review.plan.amountPaise) })}</Button>
        </> : null}
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
