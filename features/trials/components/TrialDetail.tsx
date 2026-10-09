'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowLeft, Repeat, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetailRows } from '@/components/shared/DetailRows'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { formatDisplayDate, formatTimestamp, todayInBusinessZone } from '@/lib/business-time'
import { formatINR } from '@/lib/money'
import { fulfilmentProfileService } from '../../configuration/mock-store'
import { CUSTOMER_TYPE_LABELS } from '../../customers/types'
import { getPrimaryAddress } from '../../customers/address'
import { DeliveryHistoryTable } from '../../deliveries/components/DeliveryHistoryTable'
import { deliveryService } from '../../deliveries/service'
import { trialService } from '../service'
import { CancelTrialDialog } from './CancelTrialDialog'
import { TrialStatusBadge } from './TrialStatusBadge'

export function TrialDetail({ id }: { id: string }) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const view = useMemo(() => { void revision; return trialService.getView(id) }, [id, revision])
  const deliveries = useMemo(() => { void revision; return deliveryService.getByTrial(id) }, [id, revision])
  if (!view) return <div className="product-state"><strong>Trial not found</strong><Link className="secondary-button" href="/trials">Back to trials</Link></div>

  const { trial, customer, product, variant, slot, status } = view
  const today = todayInBusinessZone()
  const profile = fulfilmentProfileService.getById(trial.fulfilmentProfileId)
  const address = customer ? getPrimaryAddress(customer) : undefined
  const upcoming = deliveries.filter(item => item.delivery.deliveryDate >= today && (item.delivery.status === 'scheduled' || item.delivery.status === 'skipped'))
  const history = deliveries.filter(item => !upcoming.includes(item)).reverse()
  const canCancel = (status === 'upcoming' || status === 'active') && today < trial.endDate
  const conversionBlock = trialService.conversionBlock(trial)
  const refresh = () => setRevision(value => value + 1)

  return <div className="workspace-page products-page">
    <header className="page-header page-header-form">
      <div className="page-title-row">
        <Button variant="outline" className="title-back-button" aria-label="Back to trials" onClick={() => router.push('/trials')}><ArrowLeft size={19} /></Button>
        <div><PageBreadcrumbs items={[{ label: 'Trials', href: '/trials' }, { label: customer?.fullName ?? 'Trial' }]} /><h1>{customer?.fullName ?? 'Unknown customer'}</h1><p className="page-description">{product?.name ?? 'Unavailable product'}{variant ? ` · ${variant.name}` : ''} · {trial.trialPlanNameSnapshot}</p></div>
      </div>
      <div className="header-actions">
        <TrialStatusBadge status={status} />
        {conversionBlock === null
          ? <Link className="primary-button" href={`/trials/${id}/convert`}><Repeat size={15} /> Convert to Subscription</Link>
          : <Button className="primary-button" disabled title={conversionBlock}><Repeat size={15} /> Convert to Subscription</Button>}
        {canCancel && <Button variant="outline" className="secondary-button destructive-outline" onClick={() => setCancelling(true)}><XCircle size={15} /> Cancel Trial</Button>}
      </div>
    </header>
    {trial.cancellation && <p className="warning-note" role="status">Cancelled effective {formatDisplayDate(trial.cancellation.effectiveDate)}{trial.cancellation.reason ? ` · ${trial.cancellation.reason}` : ''}. Deliveries after that date were cancelled; earlier ones remain.</p>}
    {status === 'converted' && trial.convertedSubscriptionId && <p className="warning-note" role="status">Converted to a subscription. <Link className="product-name-link" href={`/subscriptions/${trial.convertedSubscriptionId}`}>View subscription</Link></p>}
    {status === 'completed' && <p className="warning-note" role="status">This trial has finished. Convert it to a subscription if the customer wants to continue; nothing is created automatically.</p>}
    {conversionBlock && status !== 'converted' && status !== 'cancelled' && status !== 'completed' && <p className="help-text">Convert to Subscription is unavailable: {conversionBlock}</p>}

    <div className="product-detail-grid">
      <section className="form-card"><h2>Trial</h2>
        <DetailRows rows={[
          { label: 'Customer', value: customer ? <Link className="product-name-link" href={`/customers/${customer.id}`}>{customer.fullName}</Link> : '—' },
          { label: 'Product', value: product?.name ?? '—' },
          { label: 'Variant', value: variant?.name ?? '—' },
          { label: 'Trial plan', value: trial.trialPlanNameSnapshot },
          { label: 'Duration', value: `${trial.durationDaysSnapshot} days` },
          { label: 'Start', value: formatDisplayDate(trial.startDate) },
          { label: 'End', value: formatDisplayDate(trial.endDate) },
          { label: 'Price per delivery', value: trial.unitPricePaiseSnapshot === null ? 'Not available' : formatINR(trial.unitPricePaiseSnapshot) },
        ]} />
      </section>
      <section className="form-card"><h2>Fulfilment</h2>
        <DetailRows rows={[
          { label: 'Delivery slot', value: slot?.name ?? (trial.deliverySlotId ? 'Unavailable slot' : 'Not applicable') },
          { label: 'Fulfilment profile', value: profile?.name ?? '—' },
          { label: 'PIN', value: address?.pinCode ?? '—' },
          { label: 'Customer type', value: customer ? CUSTOMER_TYPE_LABELS[customer.customerType] : '—' },
          { label: 'Status', value: <TrialStatusBadge status={status} /> },
          { label: 'Created', value: formatTimestamp(trial.createdAt) },
        ]} />
      </section>
    </div>
    <div className="subscription-detail-stack">
      <section className="form-card" aria-labelledby="trial-upcoming-title"><h2 id="trial-upcoming-title">Upcoming Deliveries</h2>
        <DeliveryHistoryTable rows={upcoming} showProduct={false} empty="No upcoming trial deliveries." />
      </section>
      <section className="form-card" aria-labelledby="trial-history-title"><h2 id="trial-history-title">Delivery History</h2>
        <DeliveryHistoryTable rows={history} showProduct={false} empty="No trial deliveries have happened yet." />
      </section>
    </div>
    <CancelTrialDialog trialId={id} customerName={customer?.fullName ?? 'this customer'} endDate={trial.endDate} open={cancelling} onOpenChange={setCancelling} onDone={refresh} />
  </div>
}
