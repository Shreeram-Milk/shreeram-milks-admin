'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Bell, Menu, Search } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { Button as AdminButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthGate } from '@/features/auth/AuthProvider'
import { AdminSidebar } from './AdminSidebar'

/** Full-height editor routes keep the form scrolling inside the shell with a pinned save bar. */
const isEditorRoute = (path: string) => /^\/(products|customers|subscriptions)\/new$/.test(path) || /^\/(products|customers|subscriptions)\/[^/]+\/edit$/.test(path) || /^\/customers\/[^/]+\/subscriptions\/new$/.test(path)

export function ConfigurationShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `${path}?search=${encodeURIComponent(value)}` : path)
  }
  return <AuthGate><main className="app-shell">
    {mobileOpen && <AdminButton aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggleCollapse={() => setCollapsed(value => !value)} onCloseMobile={() => setMobileOpen(false)} />
    <section className="content-area">
      <header className="topbar"><AdminButton className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></AdminButton><form className="shell-search" onSubmit={submitSearch}><Search size={16} aria-hidden="true" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search pages, products, orders, CMS..." aria-label="Search admin" /></form><div className="top-actions"><AdminButton className="icon-button" aria-label="Notifications" onClick={() => toast.success('You are all caught up.')}><Bell size={17} /></AdminButton></div></header>
      <div className={`content-inner ${isEditorRoute(path) ? 'product-editor-shell' : ''}`}>{children}</div>
    </section><Toaster position="top-right" richColors />
  </main></AuthGate>
}
