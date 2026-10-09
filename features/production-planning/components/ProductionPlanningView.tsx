'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import { SelectField } from '@/components/ui/select-field'
import { DateQuickPicker } from '@/components/shared/DateQuickPicker'
import { PageBreadcrumbs } from '@/components/shared/PageBreadcrumbs'
import { useUrlListState } from '@/hooks/useUrlListState'
import { addDays, formatWeekdayDate, isIsoDate, todayInBusinessZone } from '@/lib/business-time'
import { formatProductionQuantity, PRODUCTION_UNIT_LABELS } from '../quantity'
import { productionPlanningService } from '../service'
import type { ProductionPlan, ProductionProductRequirement, SlotCutoffStatus } from '../types'
import { AreaBreakdown, SlotBreakdown, SourceBreakdown } from './ProductionBreakdowns'
import { ProductionDetailSheet } from './ProductionDetailSheet'
import { ProductRequirementsTable } from './ProductRequirementsTable'

const ALL = '__all__'
const FILTERS = { date: 'free', slot: 'free' } as const

/** "Current Forecast" while any applicable cut-off is still open, otherwise the scheduled requirement. */
function requirementLabel(plan: ProductionPlan, cutoffs: SlotCutoffStatus[], slotId: string | null | undefined): string {
  if (plan.mode === 'historical') return 'Delivered Quantity'
  const relevant = slotId === undefined ? cutoffs : cutoffs.filter(item => item.slotId === slotId)
  return relevant.some(item => item.state === 'open') ? 'Current Forecast' : 'Scheduled Requirement'
}

export function ProductionPlanningView() {
  const { filters, update } = useUrlListState(FILTERS)
  const [selected, setSelected] = useState<ProductionProductRequirement | null>(null)
  const today = todayInBusinessZone()
  const date = isIsoDate(filters.date) ? filters.date : addDays(today, 1)
  const { plan, cutoffs, slots } = useMemo(() => productionPlanningService.getPlanForDate({ date, slotId: filters.slot }), [date, filters.slot])
  const slotName = filters.slot ? slots.find(slot => slot.id === filters.slot)?.name ?? 'Selected slot' : 'All slots'
  const label = requirementLabel(plan, cutoffs, filters.slot ? filters.slot : undefined)
  const contextLabel = `${formatWeekdayDate(date)} · ${slotName}`
  const deliveriesLink = `/deliveries?date=${date}${filters.slot ? `&slot=${filters.slot}` : ''}`

  const helper = plan.mode === 'historical'
    ? 'This date is in the past. It shows quantities that were actually delivered.'
    : label === 'Current Forecast'
      ? 'Orders and subscription changes may still change this quantity before the cut-off.'
      : 'Cut-off has passed for this slot. This reflects currently scheduled deliveries.'

  return <div className="workspace-page products-page">
    <header className="page-header">
      <div><PageBreadcrumbs items={[{ label: 'Operations' }, { label: 'Production Planning' }]} /><h1>Production Planning</h1><p className="page-description">View preparation quantities from scheduled customer deliveries.</p></div>
    </header>
    <section className="product-list-section">
      <div className="delivery-toolbar">
        <DateQuickPicker label="Production date" value={date} onChange={value => update({ date: value === addDays(today, 1) ? null : value })} />
        <div className="production-slot-select"><SelectField label="Delivery slot" className="product-select-trigger" value={filters.slot || ALL} onChange={value => update({ slot: value === ALL ? null : value })} placeholder="All slots" options={[{ value: ALL, label: 'All slots' }, ...slots.map(slot => ({ value: slot.id, label: slot.status === 'active' ? slot.name : `${slot.name} · Inactive` }))]} /></div>
      </div>

      {cutoffs.length > 0 && <ul className="cutoff-status" aria-label="Cut-off status">{cutoffs.map(item => <li key={`${item.slotId}|${item.ruleName}`} className={item.state}><Clock size={14} aria-hidden="true" /><span><strong>{item.slotName} cut-off</strong> {item.label}</span></li>)}</ul>}
      {cutoffs.length === 0 && plan.mode !== 'historical' && <p className="product-hint">No cut-off configured for {slotName.toLowerCase()}.</p>}

      {plan.issues.length > 0 && <div className="serviceability-notice production-issues" role="alert">
        <AlertTriangle size={18} aria-hidden="true" />
        <div><strong>Configuration issue</strong>
          <ul>{plan.issues.map(issue => <li key={`${issue.kind}|${issue.productId}|${issue.variantId}`}><span>{issue.productName} {issue.variantName} — {issue.message}</span> <em>{issue.deliveryCount} scheduled {issue.deliveryCount === 1 ? 'delivery cannot' : 'deliveries cannot'} be included in the production total.</em> <Link href={`/products/${issue.productId}`}>View Product</Link></li>)}</ul>
        </div>
      </div>}

      {plan.deliveryCount === 0 && plan.issues.length === 0
        ? <div className="product-state"><strong>No production required</strong><span>No production-tracked deliveries are currently scheduled for {contextLabel}.</span><Link className="secondary-button" href={deliveriesLink}>View Delivery Schedule</Link></div>
        : plan.deliveryCount > 0 && <>
          <p className="production-context">{contextLabel} · <strong>{label}</strong></p>
          <p className="product-hint production-helper">{helper}</p>
          <dl className="delivery-metrics" aria-label="Production summary">
            <div><dt>Scheduled Deliveries</dt><dd>{plan.deliveryCount.toLocaleString('en-IN')}</dd></div>
            <div><dt>Products</dt><dd>{plan.productCount}</dd></div>
            <div><dt>Service Areas</dt><dd>{plan.areaCount}</dd></div>
            <div><dt>PIN Codes</dt><dd>{plan.pinCount}</dd></div>
            {plan.totalsByUnit.map(total => <div key={total.unit} className="metric-strong"><dt>{PRODUCTION_UNIT_LABELS[total.unit].heading}</dt><dd>{formatProductionQuantity(total.unit, total.requiredBase)}</dd></div>)}
          </dl>
          {plan.completedTotalsByUnit.length > 0 && <p className="product-hint">Already delivered today: {plan.completedTotalsByUnit.map(total => formatProductionQuantity(total.unit, total.requiredBase)).join(' · ')} (not part of the requirement above).</p>}
          <ProductRequirementsTable products={plan.products} requirementLabel={plan.mode === 'historical' ? 'Delivered' : 'Required'} onOpen={setSelected} />
          <div className="production-breakdowns">
            {plan.slots.length > 1 && <SlotBreakdown slots={plan.slots} labelFor={slotId => requirementLabel(plan, cutoffs, slotId)} />}
            <AreaBreakdown areas={plan.areas} />
            <SourceBreakdown sources={plan.sources} />
          </div>
          <p><Link className="secondary-button" href={deliveriesLink}>View Deliveries</Link></p>
        </>}
    </section>
    <ProductionDetailSheet plan={plan} product={selected} onClose={() => setSelected(null)} />
  </div>
}
