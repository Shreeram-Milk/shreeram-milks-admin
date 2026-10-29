'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { describeApiError } from '@/lib/api-errors'
import { formatWeekdayDate } from '@/lib/business-time'
import { tc } from '@/lib/i18n/common'
import { t } from './messages'
import { dashboardApi, type DashboardData } from './api'
import { attentionItems } from './attention'
import { KpiRows, StatusBanner } from './DashboardCards'
import { AttentionPanel, TodayPanel } from './DashboardPanels'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: DashboardData }

/** The landing page: what needs doing today and tomorrow, the money, and anything that needs attention. All figures come from the server. */
export function DashboardWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    dashboardApi.get().then(
      data => { if (!cancelled) setState({ status: 'ready', data }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [reloadKey])

  const reload = () => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }
  if (state.status === 'loading') return <PageSkeleton rows={4} />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('loadFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={reload}>{tc('tryAgain')}</Button></div>

  const { data } = state
  const items = attentionItems(data)
  return <div className="workspace-page dashboard-page">
    <header className="page-header">
      <div><p className="eyebrow">{formatWeekdayDate(data.today)}</p><h1>{t('title')}</h1><p className="page-description">{t('description')}</p></div>
      <div className="header-actions">
        <Button variant="outline" className="secondary-button" onClick={reload}><RefreshCw size={15} /> {tc('refresh')}</Button>
        <Link className="primary-button" href="/notifications/broadcasts"><Plus size={15} /> {t('sendMessage')}</Link>
      </div>
    </header>
    <StatusBanner issueTotal={items.length} />
    <KpiRows data={data} />
    <div className="dash-main">
      <div className="dash-stack"><TodayPanel data={data} /></div>
      <AttentionPanel items={items} />
    </div>
  </div>
}
