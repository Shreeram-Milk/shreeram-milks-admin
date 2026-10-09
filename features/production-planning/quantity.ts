import type { ProductionUnit } from './types'

/**
 * Quantities are held as integers in the smallest practical unit (ml, g, pieces) so repeated
 * fractional conversions can never leak binary-float errors such as 0.1 + 0.2 into the UI.
 */
const UNIT_ALIASES: Record<string, ProductionUnit> = {
  litre: 'litre', liter: 'litre', litres: 'litre', liters: 'litre', l: 'litre',
  kilogram: 'kilogram', kilograms: 'kilogram', kg: 'kilogram', kgs: 'kilogram',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece', unit: 'piece', units: 'piece',
}

export const PRODUCTION_UNIT_LABELS: Record<ProductionUnit, { name: string; short: string; heading: string }> = {
  litre: { name: 'Litre', short: 'L', heading: 'Litres required' },
  kilogram: { name: 'Kilogram', short: 'kg', heading: 'Kilograms required' },
  piece: { name: 'Piece', short: 'pcs', heading: 'Pieces required' },
}

/** Maps the product's free-text production unit onto a controlled unit; null when it isn't recognised. */
export function parseProductionUnit(raw: string): ProductionUnit | null {
  return UNIT_ALIASES[raw.trim().toLowerCase()] ?? null
}

const BASE_PER_UNIT: Record<ProductionUnit, number> = { litre: 1000, kilogram: 1000, piece: 1 }

/** Converts a per-item production quantity (e.g. 0.5 litre) into integer base units (500 ml). */
export function toBaseQuantity(unit: ProductionUnit, productionQuantity: number): number {
  return Math.round(productionQuantity * BASE_PER_UNIT[unit])
}

/** Formats integer base units for display: 130000 ml -> "130 L", 500 g -> "0.5 kg". */
export function formatProductionQuantity(unit: ProductionUnit, base: number): string {
  const value = base / BASE_PER_UNIT[unit]
  const text = Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `${Number(text).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${PRODUCTION_UNIT_LABELS[unit].short}`
}
