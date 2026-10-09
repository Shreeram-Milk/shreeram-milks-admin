export type CustomerType = 'prepaid' | 'credit'
export type CustomerStatus = 'active' | 'inactive'

/** Customers carry a list of addresses so more can be added later; today exactly one primary address is used. */
export type CustomerAddress = {
  id: string
  line1: string
  line2: string
  locality: string
  city: string
  state: string
  pinCode: string
  isPrimary: boolean
}

export type Customer = {
  id: string
  fullName: string
  mobile: string
  email: string
  status: CustomerStatus
  customerType: CustomerType
  addresses: CustomerAddress[]
  notes: string
  createdAt: string
  updatedAt: string
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

export type CustomerListQuery = {
  search: string
  status: CustomerStatus | ''
  customerType: CustomerType | ''
  page: number
  pageSize: number
}
export type CustomerListResult = { rows: Customer[]; total: number }

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = { prepaid: 'Prepaid', credit: 'Credit' }
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = { active: 'Active', inactive: 'Inactive' }
