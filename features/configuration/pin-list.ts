/** Most PIN codes the server accepts in one "paste many". */
export const MAX_PASTED_PINS = 500

/** Splits pasted text on lines, commas, semicolons and spaces, trims, and drops blanks and repeats (keeping the first of each). */
export function parsePinList(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean))]
}
