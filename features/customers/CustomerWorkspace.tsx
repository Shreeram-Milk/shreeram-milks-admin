'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { CustomerRecordDetail } from './components/CustomerRecordDetail'
import { CustomerRecordList } from './components/CustomerRecordList'
import { t } from './messages'

/** Routes /customers/** . Customers come from the backend; they sign up in the app, so there is no "add customer" page. */
export function CustomerWorkspace({ segments = [] }: { segments?: string[] }) {
  const [first] = segments
  if (segments.length === 0) return <Suspense fallback={<PageSkeleton />}><CustomerRecordList /></Suspense>
  if (first && segments.length === 1) return <CustomerRecordDetail key={first} id={first} />
  return <div className="product-state"><strong>{t('pageNotFound')}</strong><Link className="secondary-button" href="/customers">{t('backToCustomers')}</Link></div>
}
