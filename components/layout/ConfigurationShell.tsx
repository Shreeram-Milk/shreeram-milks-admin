'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Bell, Menu, Search } from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { Button as AdminButton } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthGate } from '@/features/auth/AuthProvider'
import { GuideProvider } from '@/features/tour/GuideProvider'
import { GuideMenu } from '@/features/tour/GuideMenu'
import { translator } from '@/lib/i18n/core'
import { AdminSidebar } from './AdminSidebar'
import { LanguageSwitch } from './LanguageSwitch'
import { layoutMessages } from './messages'

const t = translator(layoutMessages)

/** Full-height editor routes keep the form scrolling inside the shell with a pinned save bar. */
const isEditorRoute = (path: string) => /^\/(products|customers|subscriptions)\/new$/.test(path) || /^\/(products|customers|subscriptions)\/[^/]+\/edit$/.test(path) || /^\/customers\/[^/]+\/subscriptions\/new$/.test(path)

export function ConfigurationShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [guideNavigation, setGuideNavigation] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 1023px)')
    const onResize = () => { if (!viewport.matches) { setMobileOpen(false); setGuideNavigation(false) } }
    const onGuideNavigation = (event: Event) => {
      if (viewport.matches && event instanceof CustomEvent && typeof event.detail === 'boolean') {
        setGuideNavigation(event.detail)
        setMobileOpen(event.detail)
      }
    }
    viewport.addEventListener('change', onResize)
    window.addEventListener('admin:guide-navigation', onGuideNavigation)
    return () => {
      viewport.removeEventListener('change', onResize)
      window.removeEventListener('admin:guide-navigation', onGuideNavigation)
    }
  }, [])
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    router.push(value ? `${path}?search=${encodeURIComponent(value)}` : path)
  }
  return <AuthGate><GuideProvider><main className="app-shell">
    <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggleCollapse={() => setCollapsed(value => !value)} onCloseMobile={() => setMobileOpen(false)} />
    <section className="content-area">
      <header className="topbar"><Sheet open={mobileOpen} modal={!guideNavigation} onOpenChange={open => { setMobileOpen(open); if (!open) setGuideNavigation(false) }}><SheetTrigger asChild><AdminButton className="mobile-menu icon-button" aria-label={t('openNavigation')}><Menu size={18} /></AdminButton></SheetTrigger><SheetContent side="left" className="mobile-navigation" showCloseButton={false} aria-describedby={undefined} onInteractOutside={event => { if (guideNavigation) event.preventDefault() }}><SheetTitle className="sr-only">{t('mainNavigation')}</SheetTitle><AdminSidebar collapsed={false} mobileOpen mobileNavigation onToggleCollapse={() => setMobileOpen(false)} onCloseMobile={() => setMobileOpen(false)} /></SheetContent></Sheet><form className="shell-search" onSubmit={submitSearch}><Search size={16} aria-hidden="true" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchAdmin')} /></form><div className="top-actions"><GuideMenu /><LanguageSwitch /><AdminButton className="icon-button" aria-label={t('notifications')} onClick={() => toast.success(t('allCaughtUp'))}><Bell size={17} /></AdminButton></div></header>
      <div className={`content-inner ${isEditorRoute(path) ? 'product-editor-shell' : ''}`}>{children}</div>
    </section><Toaster position="top-right" richColors />
  </main></GuideProvider></AuthGate>
}
