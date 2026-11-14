'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageTabs } from '@/components/shared/PageTabs'
import { adjustmentAdminApi } from '../adjustment-admin/api'
import { creditAdminApi } from '../credit-admin/api'
import { walletAdminApi } from '../wallet-admin/api'
import { t } from './messages'

export type MoneyTab = 'owed' | 'credit' | 'payments' | 'wallet'

const TABS: Array<{ id: MoneyTab; href: string; label: 'tabOwed' | 'tabCredit' | 'tabPayments' | 'tabWallet' }> = [
  { id: 'owed', href: '/prepaid-adjustments', label: 'tabOwed' },
  { id: 'credit', href: '/credit-accounts', label: 'tabCredit' },
  { id: 'payments', href: '/online-payments', label: 'tabPayments' },
  { id: 'wallet', href: '/wallet-refunds', label: 'tabWallet' },
]

type ToDo = { refunds: number | null; walletRefunds: number; owing: number | null }

/**
 * The top of every Money page: what still needs doing (refunds to send, customers who owe), then a tab for each money list.
 * The two counts are small reads; the page works without them.
 */
export function MoneyHeader({ tab, description, actions }: { tab: MoneyTab; description: string; actions?: ReactNode }) {
  const [todo, setTodo] = useState<ToDo>({ refunds: null, walletRefunds: 0, owing: null })
  const current = TABS.find(item => item.id === tab) ?? TABS[0]

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([
      adjustmentAdminApi.list({ search: '', status: 'pending', type: 'refund_pending', page: 1, pageSize: 1 }),
      creditAdminApi.list({ search: '', owingOnly: true, page: 1, pageSize: 1 }),
      walletAdminApi.list({ search: '', show: 'waiting', page: 1, pageSize: 1 }),
    ]).then(([refunds, owing, wallets]) => {
      if (cancelled) return
      const walletRefunds = wallets.status === 'fulfilled' ? wallets.value.overview.waitingCount : 0
      setTodo({ refunds: refunds.status === 'fulfilled' ? refunds.value.total + walletRefunds : null, walletRefunds, owing: owing.status === 'fulfilled' ? owing.value.total : null })
    })
    return () => { cancelled = true }
  }, [])

  return <>
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: t('money') }, { label: t(current.label) }]} /><h1>{t('money')}</h1><p className="page-description">{description}</p></div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
    <div className="money-todo" aria-label={t('moneyToDo')}>
      <Link className={`money-todo-card${todo.refunds ? ' is-due' : ''}`} href={todo.walletRefunds > 0 && todo.refunds === todo.walletRefunds ? '/wallet-refunds?show=waiting' : '/prepaid-adjustments?type=refund_pending'}>
        <span>{t('refundsToSend')}</span><strong>{todo.refunds ?? '—'}</strong><small>{todo.refunds ? t('refundsHint') : t('nothingToSend')}</small><ArrowRight size={16} aria-hidden="true" />
      </Link>
      <Link className={`money-todo-card${todo.owing ? ' is-due' : ''}`} href="/credit-accounts?show=owing">
        <span>{t('customersOwe')}</span><strong>{todo.owing ?? '—'}</strong><small>{todo.owing ? t('oweHint') : t('nobodyOwes')}</small><ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
    <PageTabs label={t('money')} tabs={TABS.map(item => ({ href: item.href, label: t(item.label), active: item.id === tab }))} />
  </>
}
