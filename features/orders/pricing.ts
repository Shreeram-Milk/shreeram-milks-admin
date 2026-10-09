import { isValidPaise, type Paise } from '@/lib/money'

export const MAX_ITEM_QUANTITY = 999

export type PricedLine = { unitPricePaise: Paise; quantity: number }
export type OrderTotals = { lineTotalsPaise: Paise[]; subtotalPaise: Paise; adjustmentPaise: Paise; totalPaise: Paise }

/** Pure integer-paise maths: line = unit × quantity, subtotal = Σ lines, total = subtotal + adjustment. */
export function calculateOrderTotals(lines: PricedLine[], adjustmentPaise: Paise = 0): OrderTotals {
  const lineTotalsPaise = lines.map(line => {
    if (!isValidPaise(line.unitPricePaise) || line.unitPricePaise < 0) throw new RangeError('Unit price must be a non-negative whole number of paise.')
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_ITEM_QUANTITY) throw new RangeError(`Quantity must be a whole number from 1 to ${MAX_ITEM_QUANTITY}.`)
    return line.unitPricePaise * line.quantity
  })
  const subtotalPaise = lineTotalsPaise.reduce((sum, value) => sum + value, 0)
  return { lineTotalsPaise, subtotalPaise, adjustmentPaise, totalPaise: subtotalPaise + adjustmentPaise }
}
