'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageTabs } from '@/components/shared/PageTabs'
import { adjustmentAdminApi } from '../adjustment-admin/api'
import { creditAdminApi } from '../credit-admin/api'

export type MoneyTab = 'owed' | 'credit' | 'payments'

const TABS: Array<{ id: MoneyTab; href: string; label: string; title: string }> = [
  { id: 'owed', href: '/prepaid-adjustments', label: 'Owed to customers', title: 'Owed to prepaid customers' },
  { id: 'credit', href: '/credit-accounts', label: 'Pay-later customers', title: 'Pay-later (credit) customers' },
  { id: 'payments', href: '/online-payments', label: 'Online payments', title: 'Online payments (PhonePe)' },
]

type ToDo = { refunds: number | null; owing: number | null }

/**
 * The top of every Money page: what still needs doing (refunds to send, customers who owe), then a tab for each money list.
 * The two counts are small reads; the page works without them.
 */
export function MoneyHeader({ tab, description, actions }: { tab: MoneyTab; description: string; actions?: ReactNode }) {
  const [todo, setTodo] = useState<ToDo>({ refunds: null, owing: null })
  const current = TABS.find(item => item.id === tab) ?? TABS[0]

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      adjustmentAdminApi.list({ search: '', status: 'pending', type: 'refund_pending', page: 1, pageSize: 1 }),
      creditAdminApi.list({ search: '', owingOnly: true, page: 1, pageSize: 1 }),
    ]).then(([refunds, owing]) => {
      if (cancelled) return
      setTodo({ refunds: refunds.status === 'fulfilled' ? refunds.value.total : null, owing: owing.status === 'fulfilled' ? owing.value.total : null })
    })
    return () => { cancelled = true }
  }, [])

  return <>
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Money' }, { label: current.label }]} /><h1>Money</h1><p className="page-description">{description}</p></div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
    <div className="money-todo" aria-label="Money to do">
      <Link className={`money-todo-card${todo.refunds ? ' is-due' : ''}`} href="/prepaid-adjustments?type=refund_pending">
        <span>Refunds to send in PhonePe</span><strong>{todo.refunds ?? '—'}</strong><small>{todo.refunds ? 'Send in PhonePe, then press “Record refund”' : 'Nothing to send'}</small><ArrowRight size={16} aria-hidden="true" />
      </Link>
      <Link className={`money-todo-card${todo.owing ? ' is-due' : ''}`} href="/credit-accounts?show=owing">
        <span>Pay-later customers who owe</span><strong>{todo.owing ?? '—'}</strong><small>{todo.owing ? 'Ask for payment, or record cash or UPI received' : 'Nobody owes money'}</small><ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
    <PageTabs label="Money" tabs={TABS.map(item => ({ href: item.href, label: item.label, active: item.id === tab }))} />
  </>
}
