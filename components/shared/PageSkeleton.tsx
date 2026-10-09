import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder with the final page's shape (header, filters, rows) so content doesn't jump in. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return <div className="workspace-page products-page" aria-busy="true" aria-live="polite">
    <span className="sr-only">Loading…</span>
    <div className="page-header"><div className="skeleton-stack"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80" /></div><Skeleton className="h-10 w-40" /></div>
    <div className="skeleton-stack"><Skeleton className="h-11 w-full" /><div className="skeleton-row"><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-40" /></div></div>
    <div className="table-card skeleton-table">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
  </div>
}
