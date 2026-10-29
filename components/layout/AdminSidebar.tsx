'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Database, Factory, Wallet, MapPin, Package, PackageCheck, Repeat, Settings, ShoppingBag, Tags, Timer, Truck, Users, LayoutDashboard, LogOut, Bell, CircleHelp, GalleryHorizontal, Image, LifeBuoy, Megaphone, Scale, Percent, SlidersHorizontal, Smartphone, Globe } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button as AdminButton } from '@/components/ui/button'
import { InfoTip } from '@/components/shared/InfoTip'
import { useAuth } from '@/features/auth/AuthProvider'
import { setupHelp, type SetupScreen } from '@/features/configuration/help'
import { translator } from '@/lib/i18n/core'
import { layoutMessages } from './messages'

const t = translator(layoutMessages)
type LabelKey = keyof typeof layoutMessages.en

/** `also`: other pages that belong to this menu item (it stays highlighted there). `help`: the setup screen it explains. */
type NavEntry = { label: LabelKey; href: string; icon: LucideIcon; also?: string[]; help?: SetupScreen }

/** The things done every day, in the order a day goes. */
const dailyItems: NavEntry[] = [
  { label: 'orders', href: '/orders', icon: ShoppingBag },
  { label: 'markDeliveries', href: '/deliveries', icon: PackageCheck },
  { label: 'productionPlan', href: '/production-planning', icon: Factory },
  { label: 'subscriptions', href: '/subscriptions', icon: Repeat, also: ['/trials'] },
  { label: 'supportTickets', href: '/support', icon: LifeBuoy },
]
const peopleItems: NavEntry[] = [
  { label: 'customers', href: '/customers', icon: Users },
  { label: 'money', href: '/prepaid-adjustments', icon: Wallet, also: ['/credit-accounts', '/online-payments'] },
  { label: 'products', href: '/products', icon: Package },
]
/** Reusable setup lists that products read from. Made once, changed rarely. */
const setupItems: NavEntry[] = [
  { label: 'categories', href: '/configuration/categories', icon: Tags, help: 'categories' },
  { label: 'deliverySlots', href: '/operations/delivery-slots', icon: Truck, help: 'deliverySlots' },
  { label: 'deliveryAreas', href: '/operations/service-areas', icon: MapPin, help: 'deliveryAreas' },
  { label: 'orderByTimes', href: '/operations/cutoff-rules', icon: Timer, help: 'orderByTimes' },
  { label: 'trialPlans', href: '/configuration/trial-plans', icon: Package, help: 'trialPlans' },
  { label: 'subscriptionRules', href: '/configuration/subscription-rules', icon: Settings, help: 'subscriptionRules' },
]
/** What customers see in the phone app. */
const appItems: NavEntry[] = [
  { label: 'banners', href: '/content/banners', icon: Image },
  { label: 'offers', href: '/content/offers', icon: Percent },
  { label: 'helpCenter', href: '/content/faqs', icon: CircleHelp },
  { label: 'legalPolicies', href: '/content/policies', icon: Scale },
  { label: 'onboarding', href: '/content/onboarding', icon: GalleryHorizontal },
  { label: 'automaticMessages', href: '/notifications/templates', icon: Bell },
  { label: 'sendMessage', href: '/notifications/broadcasts', icon: Megaphone },
  { label: 'appSettings', href: '/content/app-settings', icon: SlidersHorizontal },
]
/** The public website (shreerammilk.com). Only the Home page is edited here. */
const websiteItems: NavEntry[] = [
  { label: 'homePage', href: '/website/home', icon: Globe },
]

const isOn = (pathname: string, item: NavEntry) => [item.href, ...(item.also ?? [])].some(href => pathname.startsWith(href))

export function AdminSidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}) {
  const pathname = usePathname()
  const { admin, signOut } = useAuth()

  const NavLink = ({ nested = false, ...item }: NavEntry & { nested?: boolean }) => {
    const active = isOn(pathname, item)
    const Icon = item.icon
    const label = t(item.label)
    const link = (
      <Link className={`nav-item ${nested ? 'nav-item-nested' : ''} ${active ? 'active' : ''}`} href={item.href} onClick={onCloseMobile} aria-current={active ? 'page' : undefined}>
        <Icon size={17} /><span>{label}</span>
      </Link>
    )
    if (!item.help) return link
    // The "i" button sits beside the link, not inside it: a button inside a link is not valid and not keyboard friendly.
    return <div className="nav-row">{link}<InfoTip label={label} text={setupHelp(item.help)} className="nav-info-tip" /></div>
  }
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="brand-block"><div className="brand-mark">SR</div><div className="brand-copy"><p className="brand-name">ShreeRam Milks</p><p className="brand-subtitle">{t('adminPanel')}</p></div><AdminButton className="brand-collapse" aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')} onClick={onToggleCollapse}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</AdminButton></div>
    <nav className="sidebar-nav" aria-label={t('mainNavigation')}>
      <Link className={`nav-item ${pathname === '/' ? 'active' : ''}`} href="/" onClick={onCloseMobile} aria-current={pathname === '/' ? 'page' : undefined}><LayoutDashboard size={17} /><span>{t('dashboard')}</span></Link>
      <p className="nav-label">{t('everyDay')}</p>
      {dailyItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">{t('customersShop')}</p>
      {peopleItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">{t('settings')}</p>
      <NavGroup id="setup-group" label={t('setup')} icon={Database} items={setupItems} pathname={pathname} collapsed={collapsed} render={item => <NavLink key={item.href} {...item} nested />} />
      <NavGroup id="app-group" label={t('phoneApp')} icon={Smartphone} items={appItems} pathname={pathname} collapsed={collapsed} render={item => <NavLink key={item.href} {...item} nested />} />
      <NavGroup id="website-group" label={t('website')} icon={Globe} items={websiteItems} pathname={pathname} collapsed={collapsed} render={item => <NavLink key={item.href} {...item} nested />} />
    </nav>
    <div className="profile-block"><div className="avatar" aria-hidden="true">{admin.email.slice(0, 2).toUpperCase()}</div><div className="profile-copy"><p title={admin.email}>{admin.email}</p><span>{t('administrator')}</span></div><AdminButton variant="ghost" size="icon" className="sign-out-button" aria-label={t('signOut')} title={t('signOut')} onClick={() => { void signOut() }}><LogOut size={16} /></AdminButton></div>
  </aside>
}

/** A folding menu group. It opens itself when you are on one of its pages, and never closes by itself. */
function NavGroup({ id, label, icon: Icon, items, pathname, collapsed, render }: { id: string; label: string; icon: LucideIcon; items: NavEntry[]; pathname: string; collapsed: boolean; render: (item: NavEntry) => ReactNode }) {
  const inside = items.some(item => isOn(pathname, item))
  const [open, setOpen] = useState(inside)
  const [wasInside, setWasInside] = useState(inside)
  if (inside !== wasInside) { setWasInside(inside); if (inside) setOpen(true) }
  const show = open || collapsed
  return <>
    <button type="button" className={`nav-item nav-group-toggle ${inside && !show ? 'active' : ''}`} aria-expanded={show} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Icon size={17} /><span>{label}</span><ChevronDown size={15} className={`nav-chevron ${show ? 'open' : ''}`} aria-hidden="true" />
    </button>
    {show && <div id={id} className="nav-group">{items.map(render)}</div>}
  </>
}
