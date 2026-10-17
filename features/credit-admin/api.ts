import { apiRequest } from '@/lib/api-client'
import type { ListResult } from '../configuration/api'

/** A credit customer's account: the limit staff set, and what they owe right now. */
export type CreditAccount = {
  customerId: string; name: string; phone: string; customerType: 'prepaid' | 'credit'; status: 'active' | 'blocked' | 'deleted'
  limitPaise: number; owedPaise: number; remainingPaise: number; lastPaymentAt: string | null
}
export type LedgerEntry = {
  id: string; entryType: 'order_charge' | 'payment_received' | 'order_refund' | 'manual_adjustment' | 'opening_balance'; direction: 'debit' | 'credit'; amountPaise: number
  orderId: string | null; orderNumber: string | null; paymentId: string | null; description: string; occurredOn: string; createdAt: string
  /** What the customer owed right after this entry. */
  balancePaise: number
}
export type PaymentRequest = { id: string; customerId: string; amountPaise: number; note: string; status: 'open' | 'paid' | 'cancelled'; createdAt: string; closedAt: string | null }
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'

export type CreditListParams = { search: string; owingOnly: boolean; page: number; pageSize: number }

const base = (customerId: string) => `/admin/credit-accounts/${encodeURIComponent(customerId)}`

export const creditAdminApi = {
  list({ search, owingOnly, page, pageSize }: CreditListParams): Promise<ListResult<CreditAccount>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (owingOnly) query.set('owingOnly', 'true')
    return apiRequest<ListResult<CreditAccount>>(`/admin/credit-accounts?${query}`)
  },
  get(customerId: string): Promise<{ account: CreditAccount; openRequests: PaymentRequest[] }> { return apiRequest(base(customerId)) },
  ledger(customerId: string, page: number, pageSize: number): Promise<ListResult<LedgerEntry>> { return apiRequest(`${base(customerId)}/ledger?page=${page}&pageSize=${pageSize}`) },
  async setLimit(customerId: string, limitPaise: number): Promise<CreditAccount> { return (await apiRequest<{ account: CreditAccount }>(`${base(customerId)}/limit`, { method: 'PUT', body: { limitPaise } })).account },
  async recordPayment(customerId: string, body: { amountPaise: number; method: PaymentMethod; note: string; paymentRequestId?: string }): Promise<CreditAccount> { return (await apiRequest<{ account: CreditAccount }>(`${base(customerId)}/payments`, { method: 'POST', body })).account },
  async addAdjustment(customerId: string, body: { direction: 'debit' | 'credit'; amountPaise: number; description: string }): Promise<CreditAccount> { return (await apiRequest<{ account: CreditAccount }>(`${base(customerId)}/adjustments`, { method: 'POST', body })).account },
  async createRequest(customerId: string, body: { amountPaise: number; note: string }): Promise<PaymentRequest> { return (await apiRequest<{ request: PaymentRequest }>(`${base(customerId)}/payment-requests`, { method: 'POST', body })).request },
  async cancelRequest(customerId: string, requestId: string): Promise<PaymentRequest> { return (await apiRequest<{ request: PaymentRequest }>(`${base(customerId)}/payment-requests/${encodeURIComponent(requestId)}/cancel`, { method: 'POST', body: {} })).request },
}

export const LEDGER_LABELS: Record<LedgerEntry['entryType'], string> = { order_charge: 'Order', payment_received: 'Payment received', order_refund: 'Order reversed', manual_adjustment: 'Adjustment', opening_balance: 'Opening balance' }
export const METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank transfer', other: 'Other' }
