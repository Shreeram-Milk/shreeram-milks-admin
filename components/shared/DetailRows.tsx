import type { ReactNode } from 'react'

export type DetailRow = { label: string; value: ReactNode }

/** Read-only label/value list used by summary cards. */
export function DetailRows({ rows }: { rows: DetailRow[] }) {
  return <dl className="product-detail-rows">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
}
