'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/configuration/FormField'
import { paiseToRupeeInput, parseRupeesToPaise, type Paise } from '@/lib/money'
import { creditAccountService } from '../service'

export function AccountSettingsDialog({ customerId, creditLimitPaise, open, onOpenChange, onDone }: { customerId: string; creditLimitPaise: Paise | null; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const schema = useMemo(() => z.object({
    limit: z.string().refine(value => value.trim() === '' || (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount greater than zero, or leave empty for no limit.'),
  }), [])
  type Values = z.infer<typeof schema>
  const initial = creditLimitPaise === null ? '' : paiseToRupeeInput(creditLimitPaise)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { limit: initial } })
  const [error, setError] = useState('')
  const submit = handleSubmit(values => {
    setError('')
    try {
      creditAccountService.updateSettings(customerId, { creditLimitPaise: values.limit.trim() === '' ? null : parseRupeesToPaise(values.limit) })
      toast.success('Account settings saved.')
      onOpenChange(false)
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the settings.')
    }
  })
  return <Dialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { reset({ limit: initial }); setError('') } }}>
    <DialogContent className="record-editor-dialog">
      <form onSubmit={submit} noValidate>
        <DialogHeader><DialogTitle>Account settings</DialogTitle><DialogDescription>The credit limit is a guide only. It shows a warning when exceeded and does not stop deliveries.</DialogDescription></DialogHeader>
        <div className="record-editor-fields one-column">
          <FormField label="Credit limit (₹)" error={errors.limit?.message} helper="Optional. Leave empty for no limit."><Input {...register('limit')} inputMode="decimal" autoComplete="off" placeholder="5000" /></FormField>
          <FormField label="Billing cycle" helper="Only monthly cycles are supported for now."><Input value="Monthly" disabled readOnly /></FormField>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" className="secondary-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-button" disabled={isSubmitting}>Save Settings</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
