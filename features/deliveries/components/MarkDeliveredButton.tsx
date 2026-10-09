'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { deliveryService } from '../service'

/** One-click, no confirmation: marking delivered is routine and the record cannot be toggled back casually. */
export function MarkDeliveredButton({ deliveryId, disabledReason, onDone, label = 'Mark Delivered' }: { deliveryId: string; disabledReason?: string; onDone: () => void; label?: string }) {
  const [pending, setPending] = useState(false)
  const run = () => {
    setPending(true)
    try {
      deliveryService.markDelivered(deliveryId)
      toast.success('Delivery marked as delivered.')
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the delivery.')
    } finally {
      setPending(false)
    }
  }
  return <Button type="button" variant="outline" className="secondary-button delivery-action" disabled={pending || Boolean(disabledReason)} title={disabledReason} onClick={run}>
    {pending ? <Spinner /> : <Check size={14} aria-hidden="true" />}{label}
  </Button>
}
