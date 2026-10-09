'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Database, Factory, FlaskConical, PiggyBank, LayoutDashboard, ShoppingBag, Wallet, MapPin, Package, PackageCheck, Repeat, Settings, Timer, Truck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button as AdminButton } from '@/components/ui/button'

type NavEntry = { label: string; href: string; icon: LucideIcon }

/** Reusable setup catalogs that products, customers and subscriptions read from. */
const masterDataItems: NavEntry[] = [
  { label: 'Delivery Slots', href: '/operations/delivery-slots', icon: Truck },
  { label: 'Service Areas', href: '/operations/service-areas', icon: MapPin },
  { label: 'Cut-off Rules', href: '/operations/cutoff-rules', icon: Timer },
  { label: 'Fulfilment Profiles', href: '/operations/fulfilment-profiles', icon: ClipboardList },
  { label: 'Trial Plans', href: '/configuration/trial-plans', icon: Package },
  { label: 'Subscription Rules', href: '/configuration/subscription-rules', icon: Settings },
]
const operationsItems: NavEntry[] = [
  { label: 'Deliveries', href: '/deliveries', icon: PackageCheck },
  { label: 'Production Planning', href: '/production-planning', icon: Factory },
]
const financeItems: NavEntry[] = [
  { label: 'Credit Accounts', href: '/credit-accounts', icon: Wallet },
  { label: 'Prepaid Adjustments', href: '/prepaid-adjustments', icon: PiggyBank },
]
const workItems: NavEntry[] = [
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Customers', href: '/customers', icon: Users },
]
const commerceItems: NavEntry[] = [
  { label: 'Orders', href: '/orders', icon: ShoppingBag },
  { label: 'Subscriptions', href: '/subscriptions', icon: Repeat },
  { label: 'Trials', href: '/trials', icon: FlaskConical },
]

export function AdminSidebar({ collapsed, mobileOpen, onToggleCollapse, onCloseMobile }: {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onCloseMobile: () => void
}) {
  const pathname = usePathname()
  const inMasterData = masterDataItems.some(item => pathname.startsWith(item.href))
  const [masterOpen, setMasterOpen] = useState(inMasterData)
  // Opens itself when you navigate to a catalog page; never closes by itself.
  const [wasInMasterData, setWasInMasterData] = useState(inMasterData)
  if (inMasterData !== wasInMasterData) { setWasInMasterData(inMasterData); if (inMasterData) setMasterOpen(true) }
  const showMaster = masterOpen || collapsed

  const NavLink = ({ label, href, icon: Icon, nested = false }: NavEntry & { nested?: boolean }) => (
    <Link className={`nav-item ${nested ? 'nav-item-nested' : ''} ${pathname.startsWith(href) ? 'active' : ''}`} href={href} onClick={onCloseMobile} aria-current={pathname.startsWith(href) ? 'page' : undefined}>
      <Icon size={17} /><span>{label}</span>
    </Link>
  )
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <div className="brand-block"><div className="brand-mark">SR</div><div className="brand-copy"><p className="brand-name">ShreeRam Milks</p><p className="brand-subtitle">Admin panel</p></div><AdminButton className="brand-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</AdminButton></div>
    <nav className="sidebar-nav" aria-label="Main navigation">
      <p className="nav-label">Overview</p>
      <Link className={`nav-item ${pathname === '/' ? 'active' : ''}`} href="/" onClick={onCloseMobile} aria-current={pathname === '/' ? 'page' : undefined}><LayoutDashboard size={17} /><span>Dashboard</span></Link>
      <p className="nav-label">Manage</p>
      {workItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">Commerce</p>
      {commerceItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">Operations</p>
      {operationsItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">Finance</p>
      {financeItems.map(item => <NavLink key={item.href} {...item} />)}
      <p className="nav-label">Setup</p>
      <button type="button" className={`nav-item nav-group-toggle ${inMasterData && !showMaster ? 'active' : ''}`} aria-expanded={showMaster} aria-controls="master-data-group" onClick={() => setMasterOpen(value => !value)}>
        <Database size={17} /><span>Master Data</span><ChevronDown size={15} className={`nav-chevron ${showMaster ? 'open' : ''}`} aria-hidden="true" />
      </button>
      {showMaster && <div id="master-data-group" className="nav-group">{masterDataItems.map(item => <NavLink key={item.href} {...item} nested />)}</div>}
    </nav>
    <div className="profile-block"><div className="avatar">RS</div><div className="profile-copy"><p>Rakesh Shah</p><span>Administrator</span></div></div>
  </aside>
}
