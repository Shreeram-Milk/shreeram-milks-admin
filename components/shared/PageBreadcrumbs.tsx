import Link from 'next/link'
import { Fragment } from 'react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'

export type Crumb = { label: string; href?: string }

/** Trail above a page title. The last crumb is the current page and is not a link. */
export function PageBreadcrumbs({ items }: { items: Crumb[] }) {
  return <Breadcrumb className="page-breadcrumbs"><BreadcrumbList>
    {items.map((item, index) => <Fragment key={`${item.label}-${index}`}>
      {index > 0 && <BreadcrumbSeparator />}
      <BreadcrumbItem>{item.href && index < items.length - 1 ? <BreadcrumbLink asChild><Link href={item.href}>{item.label}</Link></BreadcrumbLink> : <BreadcrumbPage>{item.label}</BreadcrumbPage>}</BreadcrumbItem>
    </Fragment>)}
  </BreadcrumbList></Breadcrumb>
}
