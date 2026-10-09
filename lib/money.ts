/**
 * INR amounts are always integer paise (₹70.00 = 7000). Nothing here uses floating-point arithmetic
 * for amounts, so totals are exact. Format and parse only at the screen edge.
 */
export type Paise = number

export const isValidPaise = (value: unknown): value is Paise => typeof value === 'number' && Number.isSafeInteger(value)

/** 7000 -> "₹70.00", 126000 -> "₹1,260.00", -5000 -> "-₹50.00". */
export function formatINR(paise: Paise): string {
  const negative = paise < 0
  const absolute = Math.abs(paise)
  const rupees = Math.floor(absolute / 100)
  const remainder = String(absolute % 100).padStart(2, '0')
  return `${negative ? '-' : ''}₹${rupees.toLocaleString('en-IN')}.${remainder}`
}

const RUPEE_INPUT = /^(\d{1,9})(?:\.(\d{1,2}))?$/

/** Parses user input like "500" or "70.5" into paise; null when it isn't a valid non-negative amount. */
export function parseRupeesToPaise(input: string): Paise | null {
  const match = RUPEE_INPUT.exec(input.trim().replace(/,/g, ''))
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** 7000 -> "70", 7050 -> "70.50": the exact text for an amount input, without any floating-point division. */
export function paiseToRupeeInput(paise: Paise): string {
  const rupees = Math.trunc(paise / 100)
  const remainder = Math.abs(paise % 100)
  return remainder === 0 ? String(rupees) : `${rupees}.${String(remainder).padStart(2, '0')}`
}

/** 7000 -> "70.00", -5050 -> "-50.50": plain decimal text for exports, without a symbol or separators. */
export function formatPaiseDecimal(paise: Paise): string {
  return `${paise < 0 ? '-' : ''}${Math.floor(Math.abs(paise) / 100)}.${String(Math.abs(paise) % 100).padStart(2, '0')}`
}
