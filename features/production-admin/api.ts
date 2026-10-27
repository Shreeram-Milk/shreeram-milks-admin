import { apiRequest } from '@/lib/api-client'

export type UnitTotal = { unit: string; quantity: number }
/** Pieces by how they were bought. */
export type TypeSplit = { oneTime: number; trial: number; subscription: number }
export type PlannedVariant = { variantId: string; variantName: string; quantity: number; orderCount: number; production: UnitTotal | null; byType: TypeSplit; cancelledQuantity: number }
export type PlannedProduct = { productId: string; productName: string; variants: PlannedVariant[]; production: UnitTotal[]; quantity: number; byType: TypeSplit; cancelledQuantity: number }
/** One delivery window: what was ordered for it, and whether more orders can still arrive. */
export type PlannedSlot = {
  slotId: string; slotName: string; startTime: string; endTime: string
  status: 'open' | 'final'; closesAt: string | null; products: PlannedProduct[]; production: UnitTotal[]
  /** Pieces to make, by how they were bought, and pieces cancelled or skipped (not counted in the amounts). */
  quantity: number; byType: TypeSplit; cancelledQuantity: number
  /** Orders still wanted in this window, each counted once. */
  orderCount: number
}
/** Something staff must know before trusting the numbers (for example subscriptions not created yet). */
export type PlanWarning = { code: string; message: string }
export type ProductionPlan = { date: string; slots: PlannedSlot[]; warnings: PlanWarning[] }

export const productionAdminApi = {
  async plan(date: string): Promise<ProductionPlan> { return (await apiRequest<{ plan: ProductionPlan }>(`/admin/production-planning?date=${encodeURIComponent(date)}`)).plan },
}

/** "20 Litre, 2.4 Kg": the totals of a window or product as one line. */
/** What to make in words. With no orders to make it says so; with orders but no production unit set on the product, it says what to fix. */
export const describeTotals = (totals: UnitTotal[], pieces: number): string => {
  if (totals.length > 0) return totals.map(total => `${total.quantity} ${total.unit}`).join(', ')
  return pieces > 0 ? 'Set production unit on the product' : 'Nothing to make'
}

/** Adds production totals of several windows or products together, per unit. */
export function sumTotals(lists: UnitTotal[][]): UnitTotal[] {
  const totals = new Map<string, number>()
  for (const list of lists) for (const total of list) totals.set(total.unit, Math.round(((totals.get(total.unit) ?? 0) + total.quantity) * 1000) / 1000)
  return [...totals].map(([unit, quantity]) => ({ unit, quantity })).sort((a, b) => a.unit.localeCompare(b.unit))
}

export const TYPE_PARTS: Array<{ key: keyof TypeSplit; label: string }> = [{ key: 'oneTime', label: 'One-time' }, { key: 'subscription', label: 'Subscription' }, { key: 'trial', label: 'Trial' }]

/** One CSV cell, quoted when it holds a comma, quote or line break. A leading = + - @ is defused so a spreadsheet never runs it as a formula. */
const cell = (value: string): string => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** The plan as CSV rows for the production floor: one line per product size in each delivery window. */
export function planToCsv(date: string, slots: PlannedSlot[]): string {
  const lines: string[][] = [['Date', 'Window', 'Start', 'End', 'Status', 'Product', 'Size', 'To make', 'Unit', 'Pieces', 'One-time', 'Subscription', 'Trial', 'Cancelled or skipped', 'Orders']]
  for (const slot of slots) for (const product of slot.products) for (const variant of product.variants) {
    lines.push([date, slot.slotName, slot.startTime, slot.endTime, slot.status === 'final' ? 'Final' : 'Open', product.productName, variant.variantName, variant.production?.quantity ?? '', variant.production?.unit ?? '', variant.quantity, variant.byType.oneTime, variant.byType.subscription, variant.byType.trial, variant.cancelledQuantity, variant.orderCount].map(String))
  }
  return lines.map(line => line.map(cell).join(',')).join('\r\n')
}
