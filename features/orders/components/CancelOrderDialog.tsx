'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { orderService } from '../service'

export function CancelOrderDialog({ orderId, orderNumber, hasDelivery, open, onOpenChange, onDone }: { orderId: string; orderNumber: string; hasDelivery: boolean; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const confirm = () => {
    setPending(true); setError('')
    try {
      orderService.cancel(orderId, reason)
      toast.success('Order cancelled.')
      onOpenChange(false)
      onDone()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to cancel the order.')
    } finally {
      setPending(false)
    }
  }
  return <AlertDialog open={open} onOpenChange={next => { onOpenChange(next); if (!next) { setReason(''); setError('') } }}>
    <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">Cancel order</p>
        <AlertDialogTitle>Cancel {orderNumber}?</AlertDialogTitle>
        <AlertDialogDescription>{hasDelivery ? 'Its scheduled delivery will be cancelled and kept in the delivery history. ' : ''}The order stays on record as Cancelled; it is never deleted.</AlertDialogDescription>
      </AlertDialogHeader>
      <div className="dialog-field"><Label htmlFor="cancel-order-reason" className="product-form-label">Reason (optional)</Label><Textarea id="cancel-order-reason" rows={2} value={reason} maxLength={200} onChange={event => setReason(event.target.value)} /></div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <AlertDialogFooter className="dialog-actions"><AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep Order</Button></AlertDialogCancel><Button className="primary-button destructive-button" disabled={pending} onClick={confirm}>Cancel Order</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
