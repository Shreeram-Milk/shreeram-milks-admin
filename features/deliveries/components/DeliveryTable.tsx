'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MoreHorizontal, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { InitialsAvatar } from '@/components/shared/InitialsAvatar'
import { todayInBusinessZone } from '@/lib/business-time'
import type { DeliveryView } from '../service'
import { DELIVERY_SOURCE_LABELS } from '../types'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { MarkDeliveredButton } from './MarkDeliveredButton'
import { MarkNotDeliveredDialog } from './MarkNotDeliveredDialog'
import { ServiceabilityWarning } from './ServiceabilityWarning'

const InactiveTag = () => <em className="product-inactive">Inactive</em>

export function DeliveryTable({ rows, onChanged }: { rows: DeliveryView[]; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState<DeliveryView | null>(null)
  const today = todayInBusinessZone()
  return <>
    <div className="table-card product-list-table-card"><Table className="config-table delivery-table">
      <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Product</TableHead><TableHead>Variant / Qty</TableHead><TableHead>Area / PIN</TableHead><TableHead>Slot</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="product-actions-column">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(view => {
        const { delivery } = view
        const name = view.customer?.fullName ?? 'Unknown customer'
        const actionable = delivery.status === 'scheduled'
        const future = delivery.deliveryDate > today
        return <TableRow key={delivery.id}>
          <TableCell><span className="identity-cell"><InitialsAvatar name={name} /><span className="identity-stack"><Link className="product-name-link" href={`/deliveries/${delivery.id}`}>{name}</Link><small>{view.customer?.mobile}</small></span></span>{view.warning && <ServiceabilityWarning message={view.warning} />}</TableCell>
          <TableCell>{view.product?.name ?? 'Unavailable product'}{view.inactive.product && <InactiveTag />}</TableCell>
          <TableCell>{view.variant?.name ?? '—'} × {delivery.quantity}{view.inactive.variant && <InactiveTag />}</TableCell>
          <TableCell>{delivery.customerAddressSnapshot.locality} · {delivery.customerPincode}</TableCell>
          <TableCell>{view.slot?.name ?? (delivery.deliverySlotId ? 'Unavailable slot' : '—')}{view.inactive.slot && <InactiveTag />}</TableCell>
          <TableCell>{DELIVERY_SOURCE_LABELS[delivery.sourceType]}</TableCell>
          <TableCell><DeliveryStatusBadge delivery={delivery} /></TableCell>
          <TableCell><div className="row-actions product-row-actions">
            {actionable && <MarkDeliveredButton deliveryId={delivery.id} disabledReason={future ? 'Available on the delivery date' : undefined} onDone={onChanged} label="Delivered" />}
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="row-menu" aria-label={`More actions for ${name}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link href={`/deliveries/${delivery.id}`}>View details</Link></DropdownMenuItem>
                {actionable && !future && <DropdownMenuItem onSelect={() => setRejecting(view)}><XCircle /> Mark not delivered</DropdownMenuItem>}
              </DropdownMenuContent></DropdownMenu>
          </div></TableCell>
        </TableRow>
      })}</TableBody>
    </Table></div>
    {rejecting && <MarkNotDeliveredDialog deliveryId={rejecting.delivery.id} customerName={rejecting.customer?.fullName ?? 'this customer'} open onOpenChange={open => { if (!open) setRejecting(null) }} onDone={onChanged} />}
  </>
}
