'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Plus, ShoppingBag } from 'lucide-react'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { formatWeekdayDate } from '@/lib/business-time'
import { useMaterializedDeliveries } from '../deliveries/useMaterializedDeliveries'
import { KpiRow, StatusBanner } from './DashboardCards'
import { IssuesPanel, TodayDeliveriesPanel, TomorrowProductionPanel } from './DashboardPanels'
import { dashboardService } from './service'

/**
 * Standard admin layout: header, three KPIs, then the detail behind them: today's and tomorrow's tables beside the attention list. Waits for the browser and for deliveries to be materialised before reading aggregates.
 */
export function DashboardWorkspace() {
  const ready = useMaterializedDeliveries()
  if (!ready) return <PageSkeleton rows={4} />
  return <DashboardContent />
}

function DashboardContent() {
  const summary = useMemo(() => dashboardService.getSummary(), [])
  return <div className="workspace-page dashboard-page">
    <header className="page-header">
      <div><p className="eyebrow">{formatWeekdayDate(summary.today)}</p><h1>Dashboard</h1><p className="page-description">What needs doing today and tomorrow.</p></div>
      <div className="header-actions">
        <Link className="secondary-button" href="/orders/new"><ShoppingBag size={15} /> Create Order</Link>
        <Link className="primary-button" href="/subscriptions/new"><Plus size={15} /> Create Subscription</Link>
      </div>
    </header>
    <StatusBanner issueTotal={summary.issueTotal} />
    <KpiRow summary={summary} />
    <div className="dash-main">
      <div className="dash-stack"><TodayDeliveriesPanel summary={summary} /><TomorrowProductionPanel summary={summary} /></div>
      <IssuesPanel summary={summary} />
    </div>
  </div>
}
