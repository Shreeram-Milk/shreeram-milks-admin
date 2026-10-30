import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DashboardData } from './api'
import { attentionItems } from './attention'

const quiet: DashboardData = {
  today: '2026-10-16', tomorrow: '2026-10-17',
  deliveries: { today: { placed: 0, out_for_delivery: 0, delivered: 0, missed: 0, cancelled: 0 }, todayTotal: 0, tomorrowTotal: 0 },
  plans: { subscriptions: 0, trials: 0 },
  money: { owedPaise: 0, owingCustomers: 0, refundsToSend: 0, refundsToSendPaise: 0, paidOnlineTodayPaise: 0 },
  customers: { active: 0, newThisWeek: 0, newPreviousWeek: 0 },
  sales: { todayPaise: 0, yesterdayPaise: 0, todayOrders: 0, yesterdayOrders: 0, last7Paise: 0, previous7Paise: 0, last7Orders: 0, previous7Orders: 0, trend: [] },
  deliveryQuality: { delivered7: 0, missed7: 0 },
  windows: [], topProducts: [], recentOrders: [],
  attention: { creditLimitSkips: 0, overdueOrders: 0, openTickets: 0 },
}

describe('what needs attention', () => {
  it('lists nothing when everything is quiet', () => {
    assert.deepEqual(attentionItems(quiet), [])
  })

  it('lists each thing that has a count, in plain words, with where to go', () => {
    const items = attentionItems({ ...quiet, money: { ...quiet.money, refundsToSend: 2, refundsToSendPaise: 14_000 }, attention: { creditLimitSkips: 1, overdueOrders: 3, openTickets: 1 } })
    assert.deepEqual(items.map(item => item.id), ['overdue', 'credit-skips', 'refunds', 'tickets'])
    assert.equal(items[0]?.title, '3 past orders are still open')
    assert.equal(items[1]?.title, '1 subscription day was skipped for the credit limit')
    assert.equal(items[2]?.title, '2 refunds to send (₹140.00)')
    assert.deepEqual(items.map(item => item.href), ['/orders', '/subscriptions', '/prepaid-adjustments', '/support'])
  })
})
