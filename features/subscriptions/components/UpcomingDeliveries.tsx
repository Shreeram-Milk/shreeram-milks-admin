'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DeliveryStatusBadge } from '@/features/deliveries/components/DeliveryStatusBadge'
import { deliveryService } from '@/features/deliveries/service'
import type { DeliveryInstance } from '@/features/deliveries/types'
import { formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { describePolicyOutcome } from '../../prepaid-adjustments/policy'
import { subscriptionService, type SubscriptionView } from '../service'

/** Upcoming means from today on, still actionable, or paused/skipped for context. Everything else is history. */
export const isUpcoming = (delivery: DeliveryInstance, today: string) =>
  delivery.deliveryDate >= today && (delivery.status === 'scheduled' || delivery.status === 'skipped' || (delivery.status === 'cancelled' && delivery.cancellationReason === 'subscription_paused'))

/** Reads materialised DeliveryInstance records; the subscription itself is only the recurring rule. */
export function UpcomingDeliveries({ view, revision, onChanged }: { view: SubscriptionView; revision: number; onChanged: () => void }) {
  const subscriptionId = view.subscription.id
  const today = todayInBusinessZone()
  const rows = useMemo(() => { void revision; return deliveryService.getBySubscription(subscriptionId).filter(item => isUpcoming(item.delivery, today)) }, [subscriptionId, revision, today])
  const [skipping, setSkipping] = useState<DeliveryInstance | null>(null)
  const cancelled = view.subscription.status === 'cancelled'

  const confirmSkip = () => {
    if (!skipping) return
    try {
      subscriptionService.addDeliveryException({ subscriptionId, date: skipping.deliveryDate, type: 'skip' })
      toast.success(`${formatWeekdayDate(skipping.deliveryDate)} delivery skipped.`)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to skip this delivery.')
    }
    setSkipping(null)
  }

  return <section className="form-card" aria-labelledby="upcoming-deliveries-title">
    <div className="section-title-row"><div><h2 id="upcoming-deliveries-title">Upcoming Deliveries</h2><p className="product-hint">The next 14 days of delivery records for this subscription.</p></div></div>
    {rows.length === 0
      ? <div className="product-state"><strong>{cancelled ? 'No deliveries after the cancellation date' : 'No upcoming deliveries'}</strong><span>{cancelled ? 'Earlier deliveries remain in the delivery history.' : 'Check the schedule, start date and pauses.'}</span></div>
      : <div className="table-card"><Table className="config-table">
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Slot</TableHead><TableHead>Status</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(({ delivery, slot }) => <TableRow key={delivery.id}>
          <TableCell><Link className="product-name-link" href={`/deliveries/${delivery.id}`}>{formatWeekdayDate(delivery.deliveryDate)}</Link></TableCell>
          <TableCell>{slot?.name ?? '—'}</TableCell>
          <TableCell><DeliveryStatusBadge delivery={delivery} /></TableCell>
          <TableCell><div className="row-actions">{delivery.status === 'scheduled' && !cancelled && <Button type="button" variant="outline" className="secondary-button preview-skip-button" onClick={() => setSkipping(delivery)} aria-label={`Skip delivery on ${formatWeekdayDate(delivery.deliveryDate)}`}><SkipForward size={14} /> Skip Delivery</Button>}</div></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>}
    <AlertDialog open={skipping !== null} onOpenChange={open => { if (!open) setSkipping(null) }}>
      {skipping && <AlertDialogContent className="confirm-dialog">
        <AlertDialogHeader>
          <p className="eyebrow">Skip delivery</p>
          <AlertDialogTitle>Skip the {formatWeekdayDate(skipping.deliveryDate)}{view.slot ? ` ${view.slot.name}` : ''} delivery?</AlertDialogTitle>
          <AlertDialogDescription asChild><div>
            <p>Only this delivery is skipped. The recurring schedule stays exactly as it is.</p>
            {view.customer?.customerType === 'prepaid' && <p className="warning-note">This customer is prepaid: {describePolicyOutcome('skip')}. It appears under Prepaid Adjustments.</p>}
          </div></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="dialog-actions">
          <AlertDialogCancel asChild><Button variant="outline" className="secondary-button">Keep Delivery</Button></AlertDialogCancel>
          <AlertDialogAction asChild><Button className="primary-button" onClick={confirmSkip}>Skip Delivery</Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>}
    </AlertDialog>
  </section>
}
