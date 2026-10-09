'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { formatINR } from '@/lib/money'
import { prepaidAdjustmentService } from '../service'
import type { PrepaidAdjustment } from '../types'

type Pending = { kind: 'cancel' | 'refund'; adjustment: PrepaidAdjustment } | null

/** Row actions for a pending adjustment. Consequential ones (cancel, refund) ask first and explain the effect. */
export function AdjustmentActions({ adjustment, customerName, onChanged }: { adjustment: PrepaidAdjustment; customerName: string; onChanged: () => void }) {
  const [pending, setPending] = useState<Pending>(null)
  if (adjustment.status !== 'pending') return null

  const run = (action: () => unknown, message: string) => {
    try { action(); toast.success(message); onChanged() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update the adjustment.') }
  }
  const isRefund = adjustment.type === 'refund_pending'
  const canRefund = (adjustment.type === 'account_credit' || adjustment.type === 'manual_adjustment') && (adjustment.amountPaise ?? 0) > 0

  return <>
    <div className="row-actions">
      {isRefund
        ? <Button type="button" variant="outline" className="secondary-button delivery-action" onClick={() => run(() => prepaidAdjustmentService.completeRefund(adjustment.id), 'Refund marked as completed.')}>Mark refund completed</Button>
        : <Button type="button" variant="outline" className="secondary-button delivery-action" onClick={() => run(() => prepaidAdjustmentService.apply(adjustment.id), 'Adjustment applied.')}>Apply</Button>}
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`More actions for ${customerName}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canRefund && <DropdownMenuItem onSelect={() => setPending({ kind: 'refund', adjustment })}>Request refund</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setPending({ kind: 'cancel', adjustment })}>Cancel adjustment</DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
    </div>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }}>
      {pending && <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">{pending.kind === 'refund' ? 'Request refund' : 'Cancel adjustment'}</p>
          <AlertDialogTitle>{pending.kind === 'refund' ? `Refund ${formatINR(pending.adjustment.amountPaise ?? 0)} to ${customerName}?` : `Cancel this adjustment for ${customerName}?`}</AlertDialogTitle>
          <AlertDialogDescription>{pending.kind === 'refund' ? 'The credit becomes a pending refund. No payment is sent from this screen; the refund stays pending until you mark it completed.' : 'The customer will no longer receive this entitlement or credit. It stays on record as Cancelled.'}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions">
          <AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep as is</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button className="primary-button" onClick={() => { const target = pending; setPending(null); run(() => target.kind === 'refund' ? prepaidAdjustmentService.requestRefund(target.adjustment.id) : prepaidAdjustmentService.cancel(target.adjustment.id), target.kind === 'refund' ? 'Refund requested.' : 'Adjustment cancelled.') }}>{pending.kind === 'refund' ? 'Request Refund' : 'Cancel Adjustment'}</Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </>
}
