import { apiRequest } from '@/lib/api-client'
import type { ListResult } from '../configuration/api'

export type CustomerRecordStatus = 'active' | 'blocked' | 'deleted'
export type CustomerRecordType = 'prepaid' | 'credit'

/** A customer as the backend describes them. Customers sign up in the app; staff only look up and adjust them. */
export type CustomerRecord = {
  id: string; phone: string | null; name: string; email: string; language: 'en' | 'gu'
  customerType: CustomerRecordType; status: CustomerRecordStatus; adminNote: string
  lastSignInAt: string | null; createdAt: string; updatedAt: string
}

/** One address the customer saved in the app. Staff can read these but not change them. */
export type CustomerRecordAddress = {
  id: string; label: 'home' | 'work' | 'other'; recipientName: string; recipientPhone: string
  line1: string; line2: string; landmark: string; city: string; pinCode: string; isDefault: boolean
}
export type CustomerRecordInstructions = {
  dropLocation: 'front-door' | 'side-gate' | 'milk-box' | 'security-desk'; handoff: 'hand-to-me' | 'leave-at-door' | 'milk-box' | 'security'
  noDoorbell: boolean; noCall: boolean; notifyAfterDelivery: boolean; additionalInstructions: string
}
export type CustomerRecordAddresses = { addresses: CustomerRecordAddress[]; instructions: CustomerRecordInstructions }

export type CustomerRecordListParams = { search: string; status: CustomerRecordStatus | ''; customerType: CustomerRecordType | ''; page: number; pageSize: number }

/** What staff may change. The server drops anything else and checks every field again. */
export type CustomerRecordPayload = { name: string; customerType: CustomerRecordType; adminNote: string }

export const customerRecordApi = {
  list({ search, status, customerType, page, pageSize }: CustomerRecordListParams): Promise<ListResult<CustomerRecord>> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) query.set('search', search)
    if (status) query.set('status', status)
    if (customerType) query.set('customerType', customerType)
    return apiRequest<ListResult<CustomerRecord>>(`/admin/customers?${query}`)
  },
  async get(id: string): Promise<CustomerRecord> { return (await apiRequest<{ customer: CustomerRecord }>(`/admin/customers/${encodeURIComponent(id)}`)).customer },
  addresses(id: string): Promise<CustomerRecordAddresses> { return apiRequest<CustomerRecordAddresses>(`/admin/customers/${encodeURIComponent(id)}/addresses`) },
  async update(id: string, payload: CustomerRecordPayload): Promise<CustomerRecord> { return (await apiRequest<{ customer: CustomerRecord }>(`/admin/customers/${encodeURIComponent(id)}`, { method: 'PUT', body: payload })).customer },
}
