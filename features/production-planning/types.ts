import type { IsoDate } from '@/lib/business-time'
import type { DeliverySourceType } from '../deliveries/types'

export type ProductionUnit = 'litre' | 'kilogram' | 'piece'
/** forecast = a future day, today = in progress, historical = already past. */
export type ProductionPlanMode = 'forecast' | 'today' | 'historical'
export type ProductionIssueKind = 'missing_conversion' | 'invalid_quantity' | 'unknown_product'

/** Requirement in integer base units (ml, g, pieces). Format with `formatProductionQuantity`. */
export type ProductionUnitTotal = { unit: ProductionUnit; requiredBase: number }

export type ProductionVariantRequirement = {
  variantId: string
  variantName: string
  /** Sum of delivery quantities, e.g. 100 for "500 ml × 100". */
  units: number
  deliveryCount: number
  requiredBase: number
}

export type ProductionProductRequirement = {
  productId: string
  productName: string
  inactive: boolean
  unit: ProductionUnit
  deliveryCount: number
  requiredBase: number
  variants: ProductionVariantRequirement[]
  sources: Array<{ sourceType: DeliverySourceType; requiredBase: number }>
}

export type ProductionAreaItem = { productId: string; productName: string; unit: ProductionUnit; requiredBase: number }
export type ProductionAreaRequirement = { pinCode: string; locality: string; deliveryCount: number; items: ProductionAreaItem[] }
export type ProductionSourceRequirement = { sourceType: DeliverySourceType; unit: ProductionUnit; requiredBase: number; deliveryCount: number }

export type ProductionSlotRequirement = {
  slotId: string | null
  slotName: string
  deliveryCount: number
  totalsByUnit: ProductionUnitTotal[]
  products: ProductionProductRequirement[]
}

export type ProductionPlanningIssue = {
  kind: ProductionIssueKind
  productId: string
  productName: string
  variantId: string
  variantName: string
  deliveryCount: number
  message: string
}

export type ProductionPlan = {
  date: IsoDate
  slotId: string
  mode: ProductionPlanMode
  /** Deliveries that contribute to the totals. */
  deliveryCount: number
  productCount: number
  areaCount: number
  pinCount: number
  totalsByUnit: ProductionUnitTotal[]
  /** Already-delivered quantity for today's view; shown separately, never added to the requirement. */
  completedTotalsByUnit: ProductionUnitTotal[]
  products: ProductionProductRequirement[]
  slots: ProductionSlotRequirement[]
  areas: ProductionAreaRequirement[]
  sources: ProductionSourceRequirement[]
  issues: ProductionPlanningIssue[]
}

export type CutoffState = 'open' | 'passed'
export type SlotCutoffStatus = { slotId: string; slotName: string; ruleName: string; state: CutoffState; label: string }
