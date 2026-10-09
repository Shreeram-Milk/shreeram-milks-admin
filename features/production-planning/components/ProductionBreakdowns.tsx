import { formatProductionQuantity } from '../quantity'
import type { ProductionAreaRequirement, ProductionSlotRequirement, ProductionSourceRequirement } from '../types'

const SOURCE_LABELS = { subscription: 'Subscription', trial: 'Trial', buy_once: 'Buy Once' } as const

/** Per-slot totals, shown when more than one slot has demand so Morning and Evening are never merged. */
export function SlotBreakdown({ slots, labelFor }: { slots: ProductionSlotRequirement[]; labelFor: (slotId: string | null) => string }) {
  return <section className="form-card" aria-labelledby="slot-breakdown-title"><h2 id="slot-breakdown-title">By delivery slot</h2>
    <div className="slot-groups">{slots.map(slot => <div key={slot.slotId ?? 'none'} className="slot-group">
      <div className="slot-group-heading"><strong>{slot.slotName}</strong><span>{slot.deliveryCount} {slot.deliveryCount === 1 ? 'delivery' : 'deliveries'} · {labelFor(slot.slotId)}</span></div>
      <ul className="breakdown-list">{slot.products.map(product => <li key={`${product.productId}|${product.unit}`}><span>{product.productName}</span><strong>{formatProductionQuantity(product.unit, product.requiredBase)}</strong></li>)}</ul>
    </div>)}</div>
  </section>
}

export function AreaBreakdown({ areas }: { areas: ProductionAreaRequirement[] }) {
  return <section className="form-card" aria-labelledby="area-breakdown-title"><h2 id="area-breakdown-title">By area / PIN</h2>
    <div className="slot-groups">{areas.map(area => <div key={area.pinCode} className="slot-group">
      <div className="slot-group-heading"><strong>{area.pinCode} · {area.locality}</strong><span>{area.deliveryCount} {area.deliveryCount === 1 ? 'delivery' : 'deliveries'}</span></div>
      <ul className="breakdown-list">{area.items.map(item => <li key={`${item.productId}|${item.unit}`}><span>{item.productName}</span><strong>{formatProductionQuantity(item.unit, item.requiredBase)}</strong></li>)}</ul>
    </div>)}</div>
  </section>
}

export function SourceBreakdown({ sources }: { sources: ProductionSourceRequirement[] }) {
  return <section className="form-card" aria-labelledby="source-breakdown-title"><h2 id="source-breakdown-title">By source</h2>
    <ul className="breakdown-list">{sources.map(source => <li key={`${source.sourceType}|${source.unit}`}><span>{SOURCE_LABELS[source.sourceType]} <small>{source.deliveryCount} {source.deliveryCount === 1 ? 'delivery' : 'deliveries'}</small></span><strong>{formatProductionQuantity(source.unit, source.requiredBase)}</strong></li>)}</ul>
  </section>
}
