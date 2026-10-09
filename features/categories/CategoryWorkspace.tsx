'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { DeactivateDialog, RecordListToolbar, RecordRowActions } from '@/components/shared/RecordListParts'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CategoryDialog } from './components/CategoryDialog'
import { categoryService } from './service'
import type { Category } from './types'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { useHydrated } from '@/hooks/useHydrated'

function CategoryWorkspaceContent() {
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  // `undefined` = editor closed, `null` = creating, a category = editing it.
  const [editing, setEditing] = useState<Category | null | undefined>(undefined)
  const [deactivating, setDeactivating] = useState<{ category: Category; dependencies: string[] } | null>(null)
  const categories = useMemo(() => { void revision; return categoryService.list() }, [revision])
  const counts = useMemo(() => { void revision; return categoryService.productCounts() }, [revision])
  const filtered = categories.filter(item => (status === 'all' || item.status === status) && `${item.name} ${item.nameGujarati} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  const refresh = () => setRevision(value => value + 1)
  const toggle = (category: Category) => {
    if (category.status === 'inactive') { categoryService.setStatus(category.id, 'active'); toast.success(`${category.name} activated.`); refresh(); return }
    setDeactivating({ category, dependencies: categoryService.dependencies(category.id) })
  }
  const confirmDeactivate = () => {
    if (!deactivating) return
    categoryService.setStatus(deactivating.category.id, 'inactive')
    toast.success(`${deactivating.category.name} deactivated.`)
    setDeactivating(null)
    refresh()
  }
  return <div className="workspace-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Master Data' }, { label: 'Categories' }]} /><h1>Categories</h1><p className="page-description">Group products so staff and customers can find them quickly.</p></div>
      <Button className="primary-button" onClick={() => setEditing(null)}><Plus size={16} /> Add Category</Button>
    </header>
    <section className="config-section">
      <RecordListToolbar noun="categories" query={query} onQueryChange={setQuery} status={status} onStatusChange={setStatus} count={filtered.length} />
      <div className="table-card"><div className="table-scroll"><Table>
        <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Gujarati</TableHead><TableHead>Order</TableHead><TableHead>Products</TableHead><TableHead>Status</TableHead><TableHead scope="col" aria-label="Actions" /></TableRow></TableHeader>
        <TableBody>
          {filtered.map(item => <TableRow key={item.id}>
            <TableCell><Button variant="ghost" className="table-link" onClick={() => setEditing(item)}>{item.name}</Button></TableCell>
            <TableCell>{item.nameGujarati || '—'}</TableCell>
            <TableCell>{item.sortOrder}</TableCell>
            <TableCell>{counts.get(item.id) ?? 0}</TableCell>
            <TableCell><StatusBadge status={item.status}>{item.status === 'active' ? 'Active' : 'Inactive'}</StatusBadge></TableCell>
            <TableCell><RecordRowActions name={item.name} active={item.status === 'active'} onEdit={() => setEditing(item)} onToggle={() => toggle(item)} /></TableCell>
          </TableRow>)}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6}><div className="empty-table">{categories.length ? 'No categories match your search and filters.' : 'No categories yet.'}{categories.length === 0 && <Button variant="link" className="text-button" onClick={() => setEditing(null)}>Create the first category</Button>}</div></TableCell></TableRow>}
        </TableBody>
      </Table></div></div>
    </section>
    {editing !== undefined && <CategoryDialog key={editing?.id ?? 'new'} category={editing} nextSortOrder={Math.max(0, ...categories.map(item => item.sortOrder)) + 1} onClose={() => setEditing(undefined)} onDone={refresh} />}
    <DeactivateDialog open={Boolean(deactivating)} noun="category" name={deactivating?.category.name ?? ''} onCancel={() => setDeactivating(null)} onConfirm={confirmDeactivate} consequence={deactivating?.dependencies.length ? `Used by ${deactivating.dependencies.join(', ')}. Those products keep this category and it shows as inactive, but it can no longer be chosen for new products.` : 'No products use this category. It can no longer be chosen for new products.'} />
  </div>
}

/** Waits for the browser, where the mock data lives, so the first render matches the server's. */
export function CategoryWorkspace() {
  const hydrated = useHydrated()
  return hydrated ? <CategoryWorkspaceContent /> : <PageSkeleton />
}
