'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Database, Factory, Wallet, MapPin, Package, PackageCheck, Repeat, Settings, ShoppingBag, Tags, Timer, Truck, Users, LayoutDashboard, LogOut, Bell, CircleHelp, GalleryHorizontal, Image, LifeBuoy, Megaphone, Scale, Percent, SlidersHorizontal, Smartphone, Globe } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button as AdminButton } from '@/components/ui/button'
import { InfoTip } from '@/components/shared/InfoTip'
import { useAuth } from '@/features/auth/AuthProvider'
import { SETUP_HELP } from '@/features/configuration/help'

/** `also`: other pages that belong to this menu item (it stays highlighted there). */
type NavEntry = { label: string; href: string; icon: LucideIcon; also?: string[] }

/** The things done every day, in the order a day goes. */
const dailyItems: NavEntry[] = [
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Mark deliveries', href: '/deliveries', icon: PackageCheck },
  { label: 'Production plan', href: '/production-planning', icon: Factory },
  { label: 'Subscriptions', href: '/subscriptions', icon: Repeat, also: ['/trials'] },
  { label: 'Support tickets', href: '/support', icon: LifeBuoy },
]
const peopleItems: NavEntry[] = [
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Money', href: '/prepaid-adjustments', icon: Wallet, also: ['/credit-accounts', '/online-payments'] },
  { label: 'Products', href: '/products', icon: Package },
]
/** Reusable setup lists that products read from. Made once, changed rarely. */
const setupItems: NavEntry[] = [
  { label: 'Categories', href: '/configuration/categories', icon: Tags },
  { label: 'Delivery Slots', href: '/operations/delivery-slots', icon: Truck },
  { label: 'Delivery Areas', href: '/operations/service-areas', icon: MapPin },
  { label: 'Order-by Times', href: '/operations/cutoff-rules', icon: Timer },
  { label: 'Trial Plans', href: '/configuration/trial-plans', icon: Package },
  { label: 'Subscription Rules', href: '/configuration/subscription-rules', icon: Settings },
]
/** What customers see in the phone app. */
const appItems: NavEntry[] = [
  { label: 'Banners', href: '/content/banners', icon: Image },
  { label: 'Offers', href: '/content/offers', icon: Percent },
  { label: 'Help Center', href: '/content/faqs', icon: CircleHelp },
  { label: 'Legal & Policies', href: '/content/policies', icon: Scale },
  { label: 'Onboarding', href: '/content/onboarding', icon: GalleryHorizontal },
  { label: 'Automatic messages', href: '/notifications/templates', icon: Bell },
  { label: 'Send a message', href: '/notifications/broadcasts', icon: Megaphone },
  { label: 'App Settings', href: '/content/app-settings', icon: SlidersHorizontal },
]
/** The public website (shreerammilk.com). Only the Home page is edited here. */
const websiteItems: NavEntry[] = [
  { label: 'Home page', href: '/website/home', icon: Globe },
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
    const link = (
      <Link className={`nav-item ${nested ? 'nav-item-nested' : ''} ${active ? 'active' : ''}`} href={item.href} onClick={onCloseMobile} aria-current={active ? 'page' : undefined}>
        <Icon size={17} /><span>{item.label}</span>
      </Link>
    )
    const help = SETUP_HELP[item.label]
    if (!help) return link
    // The "i" button sits beside the link, not inside it: a button inside a link is not valid and not keyboard friendly.
    return <div className="nav-row">{link}<InfoTip label={item.label} text={help} className="nav-info-tip" /></div>
  }
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="brand-block"><div className="brand-mark">SR</div><div className="brand-copy"><p className="brand-name">ShreeRam Milks</p><p className="brand-subtitle">Admin panel</p></div><AdminButton className="brand-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</AdminButton></div>
    <nav className="sidebar-nav" aria-label="Main navigation">
      <Link className={`nav-item ${pathname === '/' ? 'active' : ''}`} href="/" onClick={onCloseMobile} aria-current={pathname === '/' ? 'page' : undefined}><LayoutDashboard size={17} /><span>Dashboard</span></Link>
      <p className="nav-label">Every day</p>
      {dailyItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">Customers & shop</p>
      {peopleItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">Settings</p>
      <NavGroup id="setup-group" label="Setup" icon={Database} items={setupItems} pathname={pathname} collapsed={collapsed} render={item => <NavLink key={item.href} {...item} nested />} />
      <NavGroup id="app-group" label="Phone app" icon={Smartphone} items={appItems} pathname={pathname} collapsed={collapsed} render={item => <NavLink key={item.href} {...item} nested />} />
      <NavGroup id="website-group" label="Website" icon={Globe} items={websiteItems} pathname={pathname} collapsed={collapsed} render={item => <NavLink key={item.href} {...item} nested />} />
    </nav>
    <div className="profile-block"><div className="avatar" aria-hidden="true">{admin.email.slice(0, 2).toUpperCase()}</div><div className="profile-copy"><p title={admin.email}>{admin.email}</p><span>Administrator</span></div><AdminButton variant="ghost" size="icon" className="sign-out-button" aria-label="Sign out" title="Sign out" onClick={() => { void signOut() }}><LogOut size={16} /></AdminButton></div>
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
