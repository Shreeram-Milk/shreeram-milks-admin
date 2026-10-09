/**
 * A cell is quoted when it holds a comma, quote or line break. Cells that start with a formula character are
 * prefixed so a spreadsheet shows them as text instead of running them (CSV injection).
 */
export function csvCell(value: string | number): string {
  const text = String(value)
  const safe = /^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const toCsv = (rows: Array<Array<string | number>>): string => rows.map(row => row.map(csvCell).join(',')).join('\r\n')

/** Starts a browser download. A leading BOM keeps Excel from mangling non-English text such as Gujarati. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
