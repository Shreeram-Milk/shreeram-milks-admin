import { apiRequest } from '@/lib/api-client'
import { t } from './messages'

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
  return pieces > 0 ? t('setProductionUnit') : t('nothingToMake')
}

/** Adds production totals of several windows or products together, per unit. */
export function sumTotals(lists: UnitTotal[][]): UnitTotal[] {
  const totals = new Map<string, number>()
  for (const list of lists) for (const total of list) totals.set(total.unit, Math.round(((totals.get(total.unit) ?? 0) + total.quantity) * 1000) / 1000)
  return [...totals].map(([unit, quantity]) => ({ unit, quantity })).sort((a, b) => a.unit.localeCompare(b.unit))
}

// The labels are read when used, so they follow the admin's language.
export const TYPE_PARTS: Array<{ key: keyof TypeSplit; readonly label: string }> = [
  { key: 'oneTime', get label() { return t('oneTime') } },
  { key: 'subscription', get label() { return t('subscription') } },
  { key: 'trial', get label() { return t('trial') } },
]

/** One CSV cell, quoted when it holds a comma, quote or line break. A leading = + - @ is defused so a spreadsheet never runs it as a formula. */
const cell = (value: string): string => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** The plan as CSV rows for the production floor: one line per product size in each delivery window. */
export function planToCsv(date: string, slots: PlannedSlot[]): string {
  const lines: string[][] = [[t('csvDate'), t('csvWindow'), t('csvStart'), t('csvEnd'), t('csvStatus'), t('product'), t('size'), t('toMake'), t('csvUnit'), t('pieces'), t('oneTime'), t('subscription'), t('trial'), t('cancelledSkipped'), t('csvOrders')]]
  for (const slot of slots) for (const product of slot.products) for (const variant of product.variants) {
    lines.push([date, slot.slotName, slot.startTime, slot.endTime, slot.status === 'final' ? t('final') : t('open'), product.productName, variant.variantName, variant.production?.quantity ?? '', variant.production?.unit ?? '', variant.quantity, variant.byType.oneTime, variant.byType.subscription, variant.byType.trial, variant.cancelledQuantity, variant.orderCount].map(String))
  }
  return lines.map(line => line.map(cell).join(',')).join('\r\n')
}

/** One product size a rider hands over or loads. */
export type RiderItem = { productId: string; variantId: string; productName: string; variantName: string; quantity: number }
/** One house on a rider sheet. */
export type RiderStop = {
  orderId: string; orderNumber: string; recipientName: string; recipientPhone: string
  addressLine1: string; addressLine2: string; landmark: string; city: string; pinCode: string; doorstepNote: string
  kind: 'one_time' | 'subscription' | 'trial'; items: RiderItem[]
}
/** One PIN code: its houses in visiting order and what to load for them. */
export type RiderArea = { pinCode: string; city: string; stops: RiderStop[]; load: RiderItem[] }
/** Every open local delivery of one window, by PIN code. "final" once nobody can order or cancel any more. */
export type RiderSheet = {
  date: string; slot: { slotId: string; name: string; startTime: string; endTime: string }
  status: 'open' | 'final'; closesAt: string | null
  areas: RiderArea[]; load: RiderItem[]; stopCount: number; truncated: boolean; warnings: PlanWarning[]
}

export const riderSheetApi = {
  async get(date: string, slotId: string): Promise<RiderSheet> {
    return (await apiRequest<{ sheet: RiderSheet }>(`/admin/production-planning/rider-sheet?date=${encodeURIComponent(date)}&slotId=${encodeURIComponent(slotId)}`)).sheet
  },
}

/** Adds the load lines of several areas together, per product size, in the order the server sorted them. */
export function sumLoad(lists: RiderItem[][]): RiderItem[] {
  const lines = new Map<string, RiderItem>()
  for (const list of lists) for (const item of list) {
    const key = `${item.productId}|${item.variantId}`
    const line = lines.get(key)
    if (line) line.quantity += item.quantity
    else lines.set(key, { ...item })
  }
  return [...lines.values()].sort((a, b) => a.productName.localeCompare(b.productName) || a.variantName.localeCompare(b.variantName, 'en-IN', { numeric: true }))
}
