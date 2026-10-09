'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, Edit2, MoreHorizontal, Pause, Play, XCircle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { DetailRows } from '@/components/shared/DetailRows'
import { formatDisplayDate, formatTimestamp, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { getPrimaryAddress } from '@/features/customers/address'
import { CUSTOMER_TYPE_LABELS } from '@/features/customers/types'
import { nextDeliveryLabel } from '../next-delivery'
import { describeWeekdays } from '../schedule'
import { subscriptionService, type SubscriptionView } from '../service'
import type { SubscriptionDeliveryException } from '../types'
import { SCHEDULE_TYPE_LABELS } from '../types'
import { CancelSubscriptionDialog } from './CancelSubscriptionDialog'
import { PauseSubscriptionDialog } from './PauseSubscriptionDialog'
import { ResumeSubscriptionDialog } from './ResumeSubscriptionDialog'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import { UpcomingDeliveries, isUpcoming } from './UpcomingDeliveries'
import { DeliveryHistoryTable } from '@/features/deliveries/components/DeliveryHistoryTable'
import { deliveryService } from '@/features/deliveries/service'

const HISTORY_LIMIT = 25
type ActiveDialog = 'pause' | 'resume' | 'cancel' | null
type ActivityItem = { id: string; sortKey: string; when: string; title: string; detail: string }

/** Timeline of what happened to the subscription, built from its stored pauses, skips and cancellation. */
function buildActivity(view: SubscriptionView, exceptions: SubscriptionDeliveryException[]): ActivityItem[] {
  const { subscription } = view
  const items: ActivityItem[] = [{ id: 'created', sortKey: subscription.createdAt, when: formatTimestamp(subscription.createdAt), title: 'Subscription created', detail: `Starts ${formatDisplayDate(subscription.startDate)}` }]
  for (const pause of subscription.pauses) {
    items.push({ id: pause.id, sortKey: pause.fromDate, when: formatDisplayDate(pause.fromDate), title: pause.resumeDate ? `Paused until ${formatDisplayDate(pause.resumeDate)}` : 'Paused until resumed', detail: pause.reason })
  }
  for (const skip of exceptions) {
    items.push({ id: skip.id, sortKey: skip.date, when: formatDisplayDate(skip.date), title: 'Delivery skipped', detail: skip.reason })
  }
  if (subscription.cancellation) {
    items.push({ id: 'cancelled', sortKey: subscription.cancellation.effectiveDate, when: formatDisplayDate(subscription.cancellation.effectiveDate), title: 'Cancelled', detail: subscription.cancellation.reason })
  }
  return items.sort((x, y) => y.sortKey.localeCompare(x.sortKey))
}

export function SubscriptionDetail({ id }: { id: string }) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [dialog, setDialog] = useState<ActiveDialog>(null)
  const view = useMemo(() => { void revision; return subscriptionService.getView(id) }, [id, revision])
  const today = todayInBusinessZone()
  const history = useMemo(() => { void revision; return deliveryService.getBySubscription(id).filter(item => !isUpcoming(item.delivery, today)).reverse().slice(0, HISTORY_LIMIT) }, [id, revision, today])
  if (!view) return <div className="product-state"><strong>Subscription not found</strong><Link className="secondary-button" href="/subscriptions">Back to subscriptions</Link></div>

  const { subscription, customer, product, variant, slot, profile, status, nextDelivery } = view
  const address = customer ? getPrimaryAddress(customer) : undefined
  const refresh = () => setRevision(value => value + 1)
  const lastPause = subscription.pauses[subscription.pauses.length - 1]
  const cancelled = subscription.status === 'cancelled'
  const closeDialog = (open: boolean) => { if (!open) setDialog(null) }
  const activity = buildActivity(view, subscriptionService.getPreview(id, 1).exceptions)

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to subscriptions" onClick={() => router.push('/subscriptions')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Subscriptions', href: '/subscriptions' }, { label: customer?.fullName ?? 'Subscription' }]} /><h1>{customer?.fullName ?? 'Unknown customer'}</h1><p className="page-description">{product?.name ?? 'Unavailable product'}{variant ? ` · ${variant.name}` : ''}</p></div>
      </div>
      <div className="header-actions">
        <SubscriptionStatusBadge status={status} />
        {!cancelled && <Link className="secondary-button" href={`/subscriptions/${id}/edit`}><Edit2 size={15} /> Edit</Link>}
        {(status === 'active' || status === 'upcoming') && <Button className="primary-button" onClick={() => setDialog('pause')}><Pause size={15} /> Pause</Button>}
        {status === 'paused' && <Button className="primary-button" onClick={() => setDialog('resume')}><Play size={15} /> Resume</Button>}
        {!cancelled && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="secondary-button" aria-label="More actions"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setDialog('cancel')}><XCircle /> Cancel subscription</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
      </div>
    </header>
    {cancelled && subscription.cancellation && <p className="warning-note" role="status">Cancelled effective {formatDisplayDate(subscription.cancellation.effectiveDate)}{subscription.cancellation.reason ? ` · ${subscription.cancellation.reason}` : ''}. This subscription is view-only.</p>}
    {status === 'paused' && lastPause && <p className="warning-note" role="status">Paused from {formatDisplayDate(lastPause.fromDate)}{lastPause.resumeDate ? `, resuming automatically on ${formatDisplayDate(lastPause.resumeDate)}` : ' until resumed'}.{lastPause.reason ? ` ${lastPause.reason}` : ''}</p>}
    <Tabs defaultValue="overview">
      <TabsList aria-label="Subscription sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="upcoming">Upcoming Deliveries</TabsTrigger>
        <TabsTrigger value="history">Delivery History</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="product-detail-grid">
          <section className="form-card"><h2>Subscription</h2>
            <DetailRows rows={[
              { label: 'Customer', value: customer ? <Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.fullName}</Link> : '—' },
              { label: 'Product', value: product?.name ?? '—' },
              { label: 'Variant', value: variant?.name ?? '—' },
              { label: 'Schedule', value: SCHEDULE_TYPE_LABELS[subscription.schedule.scheduleType] },
              ...(subscription.schedule.scheduleType === 'custom_weekdays' ? [{ label: 'Selected weekdays', value: describeWeekdays(subscription.schedule.weekdays) }] : []),
              ...(subscription.schedule.scheduleType === 'alternate_days' && subscription.schedule.alternatePatternDate ? [{ label: 'Pattern starts', value: formatDisplayDate(subscription.schedule.alternatePatternDate) }] : []),
              { label: 'Delivery slot', value: slot?.name ?? (subscription.deliverySlotId ? 'Unavailable slot' : 'Not applicable') },
              { label: 'Start date', value: formatDisplayDate(subscription.startDate) },
              { label: 'Next delivery', value: nextDelivery ? formatWeekdayDate(nextDelivery) : nextDeliveryLabel(view) },
            ]} />
          </section>
          <section className="form-card"><h2>Fulfilment &amp; customer</h2>
            <DetailRows rows={[
              { label: 'Fulfilment profile', value: profile?.name ?? '—' },
              { label: 'PIN', value: address?.pinCode ?? '—' },
              { label: 'Customer type', value: customer ? CUSTOMER_TYPE_LABELS[customer.customerType] : '—' },
              { label: 'Status', value: <SubscriptionStatusBadge status={status} /> },
            ]} />
          </section>
        </div>
      </TabsContent>
      <TabsContent value="upcoming">
        <UpcomingDeliveries view={view} revision={revision} onChanged={refresh} />
      </TabsContent>
      <TabsContent value="history">
        <section className="form-card" aria-labelledby="recent-deliveries-title"><h2 id="recent-deliveries-title">Delivery History</h2>
          <p className="product-hint">Delivered, not delivered, skipped and cancelled deliveries. Showing the most recent {HISTORY_LIMIT}.</p>
          <DeliveryHistoryTable rows={history} showProduct={false} empty="No deliveries have happened yet." />
        </section>
      </TabsContent>
      <TabsContent value="activity">
        <section className="form-card" aria-labelledby="activity-title"><h2 id="activity-title">Activity</h2>
          <p className="product-hint">Changes to this subscription’s schedule, newest first.</p>
          <ul className="activity-list">{activity.map(item => <li key={item.id}><span>{item.when}</span><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}</div></li>)}</ul>
        </section>
      </TabsContent>
    </Tabs>
    <PauseSubscriptionDialog key={`pause-${revision}`} view={view} open={dialog === 'pause'} onOpenChange={closeDialog} onDone={refresh} />
    <ResumeSubscriptionDialog key={`resume-${revision}`} view={view} open={dialog === 'resume'} onOpenChange={closeDialog} onDone={refresh} />
    <CancelSubscriptionDialog key={`cancel-${revision}`} view={view} open={dialog === 'cancel'} onOpenChange={closeDialog} onDone={refresh} />
  </div>
}
