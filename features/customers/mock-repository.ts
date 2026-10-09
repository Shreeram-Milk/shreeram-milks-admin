import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { Customer, CustomerAddress } from './types'

const KEY = 'shreeram-admin-customers-v1'
const now = () => new Date().toISOString()

const address = (id: string, line1: string, locality: string, pinCode: string, line2 = ''): CustomerAddress => ({ id, line1, line2, locality, city: 'Gandhinagar', state: 'Gujarat', pinCode, isPrimary: true })
const customer = (id: string, fullName: string, mobile: string, customerType: Customer['customerType'], primary: CustomerAddress, status: Customer['status'] = 'active', email = ''): Customer =>
  ({ id, fullName, mobile, email, status, customerType, addresses: [primary], notes: '', createdAt: '2026-08-12T09:30:00.000Z', updatedAt: '2026-09-28T11:00:00.000Z' })

const seed: Customer[] = [
  customer('customer-rakesh', 'Rakesh Patel', '9876543210', 'prepaid', address('addr-rakesh', 'B-14, Shanti Apartments', 'Sector 10', '382010', 'Near Community Hall'), 'active', 'rakesh.patel@example.com'),
  customer('customer-meena', 'Meena Shah', '9825000000', 'credit', address('addr-meena', '22, Green Park Society', 'Sector 11', '382011')),
  customer('customer-anita', 'Anita Desai', '9898012345', 'prepaid', address('addr-anita', 'A-7, Lake View', 'Sector 12', '382012')),
  customer('customer-kiran', 'Kiran Joshi', '9712345678', 'credit', address('addr-kiran', '5, Hill Road', 'Sector 30', '382999')),
  customer('customer-suresh', 'Suresh Mehta', '9033311122', 'prepaid', address('addr-suresh', '9, Palm Residency', 'Sector 10', '382010'), 'inactive'),
]

const read = () => readCollection<Customer[]>(KEY, seed)
const write = (customers: Customer[]) => writeCollection(KEY, customers)

export const customerRepository = {
  list: () => read(),
  get: (id: string) => read().find(item => item.id === id),
  insert(record: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer {
    const timestamp = now()
    const created: Customer = { ...record, id: `customer-${crypto.randomUUID()}`, createdAt: timestamp, updatedAt: timestamp }
    write([...read(), created])
    return created
  },
  replace(id: string, changes: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer | undefined {
    let updated: Customer | undefined
    write(read().map(item => item.id === id ? (updated = { ...item, ...changes, updatedAt: now() }) : item))
    return updated
  },
}
