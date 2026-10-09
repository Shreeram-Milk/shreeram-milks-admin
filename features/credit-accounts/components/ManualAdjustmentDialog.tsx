'use client'

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { FormSelect } from '@/components/shared/FormSelect'
import { formatINR, parseRupeesToPaise, type Paise } from '@/lib/money'
import { creditAccountService } from '../service'
import { ADJUSTMENT_REASON_LABELS, type AdjustmentReason } from '../types'

const reasons = Object.keys(ADJUSTMENT_REASON_LABELS) as [AdjustmentReason, ...AdjustmentReason[]]
const DIRECTION_LABELS = { increase: 'Increase amount owed', reduce: 'Reduce amount owed' } as const

export function ManualAdjustmentDialog({ customerId, customerName, balancePaise, open, onOpenChange, onDone }: { customerId: string; customerName: string; balancePaise: Paise; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const schema = useMemo(() => z.object({
    direction: z.enum(['increase', 'reduce'], { error: 'Choose a direction.' }),
    amount: z.string().refine(value => { const paise = parseRupeesToPaise(value); return paise !== null && paise > 0 }, 'Enter an amount greater than zero (up to 2 decimals).'),
    reason: z.enum(reasons, { error: 'Select a reason.' }),
    notes: z.string().trim().max(300, 'Keep notes under 300 characters.'),
  }).superRefine((value, context) => {
    const paise = parseRupeesToPaise(value.amount)
    if (value.reason === 'other' && !value.notes) context.addIssue({ code: 'custom', path: ['notes'], message: 'Add a note when the reason is Other.' })
    if (value.direction === 'reduce' && paise !== null && paise > balancePaise) context.addIssue({ code: 'custom', path: ['amount'], message: `The reduction cannot exceed the outstanding balance of ${formatINR(Math.max(balancePaise, 0))}.` })
  }), [balancePaise])
  type Values = z.infer<typeof schema>
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { direction: 'reduce', amount: '', reason: 'billing_correction', notes: '' } })
  const [direction, amount] = useWatch({ control, name: ['direction', 'amount'] })
  const [confirming, setConfirming] = useState<Values | null>(null)
  const [error, setError] = useState('')
  const paise = parseRupeesToPaise(amount)
  const resulting = paise !== null && paise > 0 ? balancePaise + (direction === 'increase' ? paise : -paise) : null

  const post = (values: Values) => {
    setError('')
    try {
      creditAccountService.addAdjustment(customerId, { direction: values.direction, amountPaise: parseRupeesToPaise(values.amount) ?? 0, reason: values.reason, notes: values.notes })
      toast.success('Adjustment recorded.')
      setConfirming(null)
      onOpenChange(false)
      reset()
      onDone()
    } catch (failure) {
      setConfirming(null)
      setError(failure instanceof Error ? failure.message : 'Unable to record the adjustment.')
    }
  }

  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset(); setError(''); setConfirming(null) } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={handleSubmit(values => setConfirming(values))} noValidate>
        <DialogHeader><DialogTitle>Manual adjustment for {customerName}</DialogTitle><DialogDescription>Creates a new ledger entry. Earlier entries stay exactly as they are.</DialogDescription></DialogHeader>
        {confirming === null ? <>
          <div className="record-editor-fields one-column">
            <FormField label="Adjustment type" required error={errors.direction?.message}><FormSelect control={control} name="direction" label="Adjustment type" placeholder="Choose a direction" options={[{ value: 'increase', label: DIRECTION_LABELS.increase }, { value: 'reduce', label: DIRECTION_LABELS.reduce }]} /></FormField>
            <FormField label="Amount (₹)" required error={errors.amount?.message}><Input {...register('amount')} inputMode="decimal" autoComplete="off" placeholder="60" aria-invalid={errors.amount ? true : undefined} /></FormField>
            <FormField label="Reason" required error={errors.reason?.message}><FormSelect control={control} name="reason" label="Reason" placeholder="Select a reason" options={reasons.map(reason => ({ value: reason, label: ADJUSTMENT_REASON_LABELS[reason] }))} /></FormField>
            <FormField label="Notes" error={errors.notes?.message}><Textarea {...register('notes')} rows={2} placeholder="Optional (required for Other)" /></FormField>
          </div>
          <dl className="balance-preview" aria-live="polite">
            <div><dt>Current balance</dt><dd>{formatINR(balancePaise)}</dd></div>
            <div><dt>Adjustment</dt><dd>{paise !== null && paise > 0 ? `${direction === 'increase' ? '+' : '−'} ${formatINR(paise)}` : '—'}</dd></div>
            <div><dt>Resulting balance</dt><dd>{resulting === null ? '—' : formatINR(resulting)}</dd></div>
          </dl>
          {error && <p className="field-error" role="alert">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Review Adjustment</Button></DialogFooter>
        </> : <>
          <p className="warning-note">You are about to {confirming.direction === 'increase' ? 'increase' : 'reduce'} {customerName}’s balance by <strong>{formatINR(parseRupeesToPaise(confirming.amount) ?? 0)}</strong>, from {formatINR(balancePaise)} to <strong>{formatINR(resulting ?? balancePaise)}</strong>. This is recorded as a permanent ledger entry and cannot be deleted; a mistake can only be corrected by another adjustment.</p>
          <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => setConfirming(null)}>Back</Button><Button type="button" className="primary-button" onClick={() => post(confirming)}>Confirm Adjustment</Button></DialogFooter>
        </>}
      </form>
    </DialogContent>
  </Dialog>
}
