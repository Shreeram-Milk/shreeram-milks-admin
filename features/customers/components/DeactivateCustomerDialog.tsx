'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { customerService } from '../service'
import type { Customer } from '../types'

export function DeactivateCustomerDialog({ customer, onClose, onDone }: { customer: Customer | null; onClose: () => void; onDone: () => void }) {
  const impact = customer ? customerService.deactivationImpact(customer.id) : { openSubscriptions: 0 }
  const confirm = () => {
    if (!customer) return
    try { customerService.deactivate(customer.id); toast.success(`${customer.fullName} deactivated.`); onDone() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to deactivate customer.') }
    onClose()
  }
  return <AlertDialog open={customer !== null} onOpenChange={open => { if (!open) onClose() }}>
    {customer && <AlertDialogContent className="confirm-dialog">
      <AlertDialogHeader>
        <p className="eyebrow">Customer deactivation</p>
        <AlertDialogTitle>Deactivate “{customer.fullName}”?</AlertDialogTitle>
        <AlertDialogDescription asChild><div>
          <p>{impact.openSubscriptions > 0 ? `This customer has ${impact.openSubscriptions} subscription${impact.openSubscriptions === 1 ? '' : 's'} that are not cancelled.` : 'This customer has no open subscriptions.'}</p>
          <p className="warning-note">New subscriptions cannot be created for inactive customers. Existing subscriptions, orders, and delivery history are not changed — pause or cancel subscriptions separately if deliveries should stop.</p>
        </div></AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="dialog-actions">
        <AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Cancel</Button></AlertDialogCancel>
        <AlertDialogAction asChild><Button className="primary-button" onClick={confirm}>Deactivate</Button></AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>}
  </AlertDialog>
}
