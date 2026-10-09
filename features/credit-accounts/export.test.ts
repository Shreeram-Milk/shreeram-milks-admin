import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { csvCell, toCsv } from '@/lib/csv'
import { formatPaiseDecimal } from '@/lib/money'
import { passbookCsv } from '../prepaid-adjustments/passbook-csv'
import { prepaidAdjustmentService } from '../prepaid-adjustments/service'
import { creditAccountService } from './service'
import { statementCsv } from './statement-csv'

declare const __resetStorage: () => void

beforeEach(() => __resetStorage())

describe('csv', () => {
  it('quotes cells with commas, quotes and line breaks', () => {
    assert.equal(csvCell('a,b'), '"a,b"')
    assert.equal(csvCell('say "hi"'), '"say ""hi"""')
    assert.equal(csvCell('line1\nline2'), '"line1\nline2"')
    assert.equal(toCsv([['a', 1], ['b', 2]]), 'a,1\r\nb,2')
  })
  it('stops spreadsheet formulas from running but keeps real negative numbers', () => {
    assert.equal(csvCell('=SUM(A1:A9)'), "'=SUM(A1:A9)")
    assert.equal(csvCell('+91 98765'), "'+91 98765")
    assert.equal(csvCell('@cmd'), "'@cmd")
    assert.equal(csvCell('-50.50'), '-50.50')
    assert.equal(csvCell(-5), '-5')
  })
  it('writes paise as exact rupee decimals', () => {
    assert.equal(formatPaiseDecimal(7000), '70.00')
    assert.equal(formatPaiseDecimal(5), '0.05')
    assert.equal(formatPaiseDecimal(-5050), '-50.50')
  })
})

describe('exports', () => {
  it('writes a credit statement with its summary and one line per ledger entry', () => {
    const month = new Date().toISOString().slice(0, 7)
    const customerId = 'customer-meena'
    const { summary, rows } = creditAccountService.getStatement(customerId, month)
    const lines = statementCsv('Meena Shah', month, summary, rows).split('\r\n')
    assert.equal(lines[0], 'Customer,Meena Shah')
    assert.ok(lines.some(line => line.startsWith('Closing balance (INR),')))
    assert.equal(lines.length, 9 + rows.length)
  })
  it('writes a prepaid passbook with a row per adjustment', () => {
    const adjustment = prepaidAdjustmentService.createManual({ customerId: 'customer-rakesh', amountPaise: 12550, reason: 'Goodwill, "late" delivery' })
    const csv = passbookCsv('Rakesh Patel', [adjustment])
    assert.ok(csv.includes('125.50'))
    assert.ok(csv.includes('"Goodwill, ""late"" delivery"'))
    assert.equal(csv.split('\r\n').length, 5)
  })
})
