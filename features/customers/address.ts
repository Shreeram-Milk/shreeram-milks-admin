import type { Customer, CustomerAddress } from './types'

export function getPrimaryAddress(customer: Pick<Customer, 'addresses'>): CustomerAddress | undefined {
  return customer.addresses.find(address => address.isPrimary) ?? customer.addresses[0]
}

export function formatAddress(address: CustomerAddress | undefined): string {
  if (!address) return '—'
  return [address.line1, address.line2, address.locality, `${address.city} ${address.pinCode}`, address.state].filter(Boolean).join(', ')
}

export function formatAreaAndPin(address: CustomerAddress | undefined): string {
  return address ? `${address.locality} · ${address.pinCode}` : '—'
}
