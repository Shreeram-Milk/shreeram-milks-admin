import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDisplayDate } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { LEDGER_TYPE_LABELS, type LedgerRow } from '../types'

const labelOf = (row: LedgerRow) => String(row.metadata.referenceLabel ?? row.referenceId)

/** Rows arrive with running balances already computed oldest-first; this only presents them. */
export function LedgerTable({ rows, compact = false }: { rows: LedgerRow[]; compact?: boolean }) {
  return <div className="table-card"><Table className="config-table ledger-table">
    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead>{!compact && <TableHead>Description</TableHead>}<TableHead className="numeric">Charge</TableHead><TableHead className="numeric">Credit</TableHead><TableHead className="numeric">Running Balance</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(row => <TableRow key={row.id}>
      <TableCell>{formatDisplayDate(row.occurredOn)}</TableCell>
      <TableCell>{LEDGER_TYPE_LABELS[row.type]}</TableCell>
      <TableCell>{row.referenceType === 'delivery' ? <Link className="product-name-link" href={`/deliveries/${row.referenceId}`}>{labelOf(row)}</Link> : labelOf(row)}</TableCell>
      {!compact && <TableCell>{row.description}</TableCell>}
      <TableCell className="numeric">{row.direction === 'debit' ? formatINR(row.amountPaise) : '—'}</TableCell>
      <TableCell className="numeric">{row.direction === 'credit' ? formatINR(row.amountPaise) : '—'}</TableCell>
      <TableCell className="numeric"><strong>{formatINR(row.runningBalancePaise)}</strong></TableCell>
    </TableRow>)}</TableBody>
  </Table></div>
}
