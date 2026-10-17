import type { ProductSelectOption } from './components/ProductSelect'

/** The units a product can be measured in. One fixed list keeps "Litre" and "ltr" from becoming two different production lines. */
export const MEASURE_UNITS = ['Litre', 'Millilitre', 'Kilogram', 'Gram', 'Piece', 'Packet', 'Bottle', 'Dozen'] as const

/** The list as dropdown options; a value saved earlier that is not in the list stays selectable so editing never loses it. */
export function unitOptions(current: string): ProductSelectOption[] {
  const known = MEASURE_UNITS.map(unit => ({ value: unit, label: unit }))
  return current && !MEASURE_UNITS.some(unit => unit === current) ? [{ value: current, label: current }, ...known] : known
}

/**
 * What one item uses up when it is made, worked out from its size: 500 Millilitre uses 0.5 Litre, 250 Gram uses 0.25 Kilogram,
 * anything else uses its own unit and amount. Only a suggestion for the form; the admin can change it.
 */
export function suggestedProduction(displayUnit: string, displayQuantity: number): { productionUnit: string; productionQuantity: number } {
  if (displayUnit === 'Millilitre') return { productionUnit: 'Litre', productionQuantity: displayQuantity / 1000 }
  if (displayUnit === 'Gram') return { productionUnit: 'Kilogram', productionQuantity: displayQuantity / 1000 }
  return { productionUnit: displayUnit, productionQuantity: displayQuantity }
}
