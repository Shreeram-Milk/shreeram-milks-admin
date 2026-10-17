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
export type ProductionPlan = { date: string; slots: PlannedSlot[] }

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
