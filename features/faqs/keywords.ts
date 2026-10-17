/** "milk, Late ,milk" -> ["milk", "late"]: trimmed, lower-case, no blanks or repeats. */
export function parseKeywords(text: string): string[] {
  return [...new Set(text.split(',').map(word => word.trim().toLowerCase()).filter(Boolean))]
}
