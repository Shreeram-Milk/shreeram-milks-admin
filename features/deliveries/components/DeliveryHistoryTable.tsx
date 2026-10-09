import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatWeekdayDate } from '@/lib/business-time'
import type { DeliveryView } from '../service'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'

/** Compact list of delivery instances, reused by Customer and Subscription detail. */
export function DeliveryHistoryTable({ rows, showProduct = true, empty }: { rows: DeliveryView[]; showProduct?: boolean; empty: string }) {
  if (rows.length === 0) return <p className="product-hint">{empty}</p>
  return <div className="table-card"><Table className="config-table">
    <TableHeader><TableRow><TableHead>Date</TableHead>{showProduct && <TableHead>Product</TableHead>}<TableHead>Qty</TableHead><TableHead>Slot</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(({ delivery, product, variant, slot }) => <TableRow key={delivery.id}>
      <TableCell><Link className="product-name-link" href={`/deliveries/${delivery.id}`}>{formatWeekdayDate(delivery.deliveryDate)}</Link></TableCell>
      {showProduct && <TableCell>{product?.name ?? 'Unavailable product'}</TableCell>}
      <TableCell>{variant?.name ?? '—'} × {delivery.quantity}</TableCell>
      <TableCell>{slot?.name ?? '—'}</TableCell>
      <TableCell><DeliveryStatusBadge delivery={delivery} /></TableCell>
    </TableRow>)}</TableBody>
  </Table></div>
}
