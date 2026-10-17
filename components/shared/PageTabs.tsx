import Link from 'next/link'

export type PageTab = { href: string; label: string; active: boolean; count?: number }

/** Tabs that switch between sibling pages (each tab is a link), styled like the in-page tabs. */
export function PageTabs({ label, tabs }: { label: string; tabs: PageTab[] }) {
  return <nav className="page-tabs" aria-label={label}>
    {tabs.map(tab => <Link key={tab.href} href={tab.href} className={`page-tab${tab.active ? ' is-active' : ''}`} aria-current={tab.active ? 'page' : undefined}>
      {tab.label}{tab.count !== undefined ? <span className="tab-count">{tab.count}</span> : null}
    </Link>)}
  </nav>
}
