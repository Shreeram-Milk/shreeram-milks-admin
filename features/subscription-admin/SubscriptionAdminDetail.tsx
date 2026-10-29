'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Ban, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { PageSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { describeApiError } from '@/lib/api-errors'
import { tc } from '@/lib/i18n/common'
import { addDays, formatDisplayDate, formatTimestamp, formatWeekdayDate, todayInBusinessZone } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { ACTIVITY_LABELS, KIND_TEXT, STATE_LABELS, STATE_TONE, linesText, scheduleText, subscriptionAdminApi, type SubscriptionDetail as Detail } from './api'
import { SubscriptionDayList, type DayRow } from './SubscriptionDayList'
import { CancelDialog, PauseDialog, ResumeDialog, SkipDialog } from './SubscriptionDialogs'
import { t } from './messages'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; subscription: Detail }
type Dialog = { kind: 'pause' } | { kind: 'resume' } | { kind: 'cancel' } | { kind: 'skip'; day: DayRow } | null

const dayWord = (date: string) => {
  const today = todayInBusinessZone()
  return date === today ? t('today') : date === addDays(today, 1) ? t('tomorrow') : formatWeekdayDate(date)
}

/**
 * Everything about one subscription or trial on one page: where it stands (top), its days with skip buttons (left), and
 * the customer, money, pauses and history (right). Pause, resume and cancel sit in the header.
 */
export function SubscriptionAdminDetail({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    subscriptionAdminApi.get(id).then(
      subscription => { if (!cancelled) setState({ status: 'ready', subscription }) },
      failure => { if (!cancelled) setState({ status: 'error', message: describeApiError(failure) }) },
    )
    return () => { cancelled = true }
  }, [id, reloadKey])

  if (state.status === 'loading') return <PageSkeleton />
  if (state.status === 'error') return <div className="product-state" role="alert"><strong>{t('detailFailed')}</strong><span>{state.message}</span><Button className="secondary-button" variant="outline" onClick={() => { setState({ status: 'loading' }); setReloadKey(count => count + 1) }}>{tc('tryAgain')}</Button><Link className="secondary-button" href="/subscriptions">{t('backToSubscriptions')}</Link></div>

  const { subscription } = state
  const text = KIND_TEXT[subscription.kind]
  const live = subscription.status === 'active' || subscription.status === 'paused'
  const shownState = subscription.status === 'active' && subscription.openPause ? 'paused' : subscription.status
  const planned = subscription.deliveriesPerLine * subscription.lines.length
  const delivered = subscription.lines.reduce((sum, line) => sum + line.delivered, 0)
  // Still to come = deliveries whose order is not made yet, plus orders made and still on their way.
  const left = subscription.lines.reduce((sum, line) => sum + line.remaining, 0) + subscription.days.flatMap(day => day.lines).filter(line => line.state === 'placed' || line.state === 'out_for_delivery').length
  const share = planned > 0 ? Math.min(100, Math.round((delivered / planned) * 100)) : 0
  const customer = subscription.customerName.trim() || t('customerFallback')
  const address = subscription.address

  /** Runs one change, shows the fresh subscription, and reports the outcome. Closes the dialog only when it worked. */
  const change = async (run: () => Promise<Detail>, success: string) => {
    setBusy(true)
    try {
      setState({ status: 'ready', subscription: await run() })
      toast.success(success)
      setDialog(null)
    } catch (failure) { toast.error(describeApiError(failure)) }
    setBusy(false)
  }

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Link className="title-back-button" href={text.path} aria-label={t('backTo', { kind: text.plural.toLowerCase() })}><ArrowLeft size={19} /></Link>
        <div>
          <PageBreadcrumbs items={[{ label: text.plural, href: text.path }, { label: customer }]} />
          <div className="od-title"><h1>{customer}</h1><StatusBadge status={STATE_TONE[shownState]}>{STATE_LABELS[shownState]}</StatusBadge></div>
          <p className="page-description">{subscription.productName} {subscription.variantName} · {subscription.planName || scheduleText(subscription.scheduleType, subscription.weekdays)} · {linesText(subscription.lines)} · {text.singular} {subscription.number}</p>
        </div>
      </div>
      {live ? <div className="header-actions">
        {subscription.openPause
          ? <Button className="primary-button" onClick={() => setDialog({ kind: 'resume' })}><Play size={14} /> {t('resume')}</Button>
          : <Button className="secondary-button" variant="outline" onClick={() => setDialog({ kind: 'pause' })}><Pause size={14} /> {t('pause')}</Button>}
        {/* A vacation planned for later can also be ended early. */}
        {!subscription.openPause && subscription.pauses.length > 0 ? <Button className="secondary-button" variant="outline" onClick={() => setDialog({ kind: 'resume' })}><Play size={14} /> {t('resume')}</Button> : null}
        <Button className="secondary-button destructive-outline" variant="outline" onClick={() => setDialog({ kind: 'cancel' })}><Ban size={14} /> {t('cancel')}</Button>
      </div> : null}
    </header>

    {subscription.openPause ? <div className="setup-note attention" role="status"><div><strong>{subscription.openPause.untilDate ? t('pausedRange', { from: formatDisplayDate(subscription.openPause.fromDate), until: formatDisplayDate(subscription.openPause.untilDate) }) : t('pausedSince', { from: formatDisplayDate(subscription.openPause.fromDate) })}</strong>{t('pausedDetail')}</div></div> : null}
    {subscription.status === 'cancelled' ? <div className="setup-note" role="status"><div><strong>{subscription.cancelledAt ? t('cancelledOn', { when: formatTimestamp(subscription.cancelledAt) }) : t('cancelledTitle')}</strong>{subscription.cancelReason ? t('reason', { reason: subscription.cancelReason }) : ''}{subscription.paymentMethod === 'online' ? <>{t('refundsIn')} <Link className="product-name-link" href="/prepaid-adjustments">{t('refundsLink')}</Link>.</> : t('creditOnly')}</div></div> : null}
    {subscription.status === 'completed' ? <div className="setup-note success" role="status"><div><strong>{t('finished')}</strong>{t('finishedDetail', { kind: text.singular.toLowerCase() })}</div></div> : null}

    <div className="kpi-row card-in">
      <div className="kpi-card kpi-card-main"><span>{t('nextDelivery')}</span><strong>{subscription.nextDelivery ? dayWord(subscription.nextDelivery.date) : '—'}</strong><small>{subscription.nextDelivery ? `${subscription.nextDelivery.slotName} × ${subscription.nextDelivery.quantity}` : live ? t('nothingSoon') : STATE_LABELS[subscription.status]}</small></div>
      <div className="kpi-card tone-success"><span>{t('delivered')}</span><strong>{delivered} / {planned}</strong><span className="progress-track sub-progress" aria-hidden="true"><span style={{ width: `${share}%` }} /></span></div>
      <div className="kpi-card"><span>{t('stillToCome')}</span><strong>{left}</strong><small>{left === 1 ? t('deliveryOne') : t('deliveryMany')}</small></div>
      <div className="kpi-card"><span>{t('lastDelivery')}</span><strong>{subscription.endDate ? formatDisplayDate(subscription.endDate) : '—'}</strong><small>{subscription.openPause ? t('knownWhenResumed') : t('movesLater')}</small></div>
    </div>

    <div className="od-layout">
      <div className="od-main">
        <SubscriptionDayList subscription={subscription} busy={busy} onChange={day => setDialog({ kind: 'skip', day })} />
      </div>
      <aside className="od-side" aria-label={t('details', { kind: text.singular })}>
        <section className="panel"><header className="panel-header"><h2>{t('customer')}</h2></header>
          <div className="od-side-body">
            <p className="od-customer"><Link className="product-name-link" href={`/customers/${subscription.customerId}`}>{customer}</Link></p>
            <p className="od-muted">{subscription.customerPhone}</p>
            <p className="od-address">{address.recipientName} · {address.recipientPhone}<br />{[address.addressLine1, address.addressLine2, address.landmark, address.city].filter(Boolean).join(', ')} – {address.pinCode}</p>
            {address.doorstepNote ? <p className="od-muted">{t('doorstep', { note: address.doorstepNote })}</p> : null}
          </div>
        </section>
        <section className="panel"><header className="panel-header"><h2>{t('money')}</h2></header>
          <div className="od-side-body"><dl className="product-detail-rows">
            <div><dt>{t('price')}</dt><dd>{t('each', { amount: formatINR(subscription.unitPricePaise) })}</dd></div>
            <div><dt>{t('total')}</dt><dd>{formatINR(subscription.totalPaise)}</dd></div>
            <div><dt>{t('payment')}</dt><dd>{subscription.paymentMethod === 'credit' ? t('creditPerDelivery') : t('paidUpfront')}</dd></div>
          </dl>{subscription.paymentId ? <p className="panel-note"><Link className="product-name-link" href={`/online-payments/${subscription.paymentId}`}>{t('seePayment')}</Link></p> : null}</div>
        </section>
        <section className="panel"><header className="panel-header"><h2>{t('plan')}</h2></header>
          <div className="od-side-body"><dl className="product-detail-rows">
            <div><dt>{t('started')}</dt><dd>{formatDisplayDate(subscription.startDate)}</dd></div>
            {subscription.lines.map(line => <div key={line.id}><dt>{line.slotName} × {line.quantity}</dt><dd>{t('doneLeft', { done: line.delivered, left: line.remaining })}</dd></div>)}
            {subscription.pauses.map(pause => <div key={pause.id}><dt>{t('pauseRow')}</dt><dd>{formatDisplayDate(pause.fromDate)} – {pause.untilDate ? formatDisplayDate(pause.untilDate) : t('untilResumed')}</dd></div>)}
          </dl></div>
        </section>
        <details className="panel history-panel">
          <summary className="panel-header"><h2>{t('history')}</h2><span className="tab-count">{subscription.activity.length}</span></summary>
          <ol className="od-side-body history-list">{subscription.activity.map((step, index) => <li key={`${step.kind}-${index}`}><strong>{ACTIVITY_LABELS[step.kind] ?? step.kind}{typeof step.detail.date === 'string' ? ` · ${formatDisplayDate(step.detail.date)}` : ''}{typeof step.detail.fromDate === 'string' ? t('from', { date: formatDisplayDate(step.detail.fromDate) }) : ''}{typeof step.detail.amountPaise === 'number' ? ` · ${formatINR(step.detail.amountPaise)}` : ''}</strong><span>{formatTimestamp(step.createdAt)}{step.byStaff ? t('byStaff') : ''}</span></li>)}</ol>
        </details>
      </aside>
    </div>

    {dialog?.kind === 'pause' ? <PauseDialog busy={busy} onClose={() => setDialog(null)} onSave={(fromDate, untilDate) => void change(() => subscriptionAdminApi.pause(subscription.id, fromDate, untilDate), untilDate ? t('vacationSaved') : t('pausedUntilResumed'))} /> : null}
    {dialog?.kind === 'resume' ? <ResumeDialog busy={busy} onClose={() => setDialog(null)} onSave={fromDate => void change(() => subscriptionAdminApi.resume(subscription.id, fromDate), t('restartOn', { date: formatDisplayDate(fromDate) }))} /> : null}
    {dialog?.kind === 'cancel' ? <CancelDialog subscription={subscription} busy={busy} onClose={() => setDialog(null)} onSave={reason => void change(() => subscriptionAdminApi.cancel(subscription.id, reason), t('kindCancelled', { kind: text.singular }))} /> : null}
    {dialog?.kind === 'skip' ? <SkipDialog day={dialog.day} busy={busy} onClose={() => setDialog(null)} onConfirm={() => {
      const { day } = dialog
      const undo = day.state === 'skipped'
      void change(() => (undo ? subscriptionAdminApi.unskip(subscription.id, day.date, day.lineId) : subscriptionAdminApi.skip(subscription.id, day.date, day.lineId)), undo ? t('backOn', { date: formatDisplayDate(day.date), slot: day.slotName }) : t('skippedMoves', { date: formatDisplayDate(day.date), slot: day.slotName }))
    }} /> : null}
  </div>
}
