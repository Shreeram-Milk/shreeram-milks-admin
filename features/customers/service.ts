import { calculateBalance } from '../credit-accounts/ledger'
import { creditAccountRepository } from '../credit-accounts/mock-repository'
import { subscriptionRepository } from '../subscriptions/mock-repository'
import { customerRepository } from './mock-repository'
import { customerSchema, type CustomerFormValues } from './schema'
import type { Customer, CustomerInput, CustomerListQuery, CustomerListResult, CustomerStatus } from './types'

export class CustomerRuleError extends Error {}

function toInput(values: CustomerFormValues, existing?: Customer): CustomerInput {
  const primary = existing?.addresses.find(item => item.isPrimary) ?? existing?.addresses[0]
  return {
    fullName: values.fullName, mobile: values.mobile, email: values.email, status: values.status, customerType: values.customerType, notes: values.notes,
    // Other (future) addresses are preserved; only the primary one is edited in this phase.
    addresses: [
      { id: primary?.id ?? `addr-${crypto.randomUUID()}`, line1: values.line1, line2: values.line2, locality: values.locality, city: values.city, state: values.state, pinCode: values.pinCode, isPrimary: true },
      ...(existing?.addresses.filter(item => item.id !== primary?.id) ?? []).map(item => ({ ...item, isPrimary: false })),
    ],
  }
}

/**
 * The single rule for changing a customer's account model.
 * Credit -> Prepaid is blocked while money is owed; Prepaid -> Credit opens a credit account.
 */
function applyCustomerTypeChange(existing: Customer | undefined, nextType: Customer['customerType'], customerId: string) {
  if (existing && existing.customerType === 'credit' && nextType === 'prepaid') {
    const balance = calculateBalance(creditAccountRepository.listEntriesForCustomer(customerId))
    if (balance !== 0) throw new CustomerRuleError('Settle or adjust the outstanding credit balance before changing this customer to Prepaid.')
  }
  if (nextType === 'credit') creditAccountRepository.ensure(customerId)
}

function assertUniqueMobile(mobile: string, ignoreId?: string) {
  if (customerRepository.list().some(item => item.id !== ignoreId && item.mobile === mobile)) throw new CustomerRuleError('A customer with this mobile number already exists.')
}

/** Server-side validation stand-in: the same schema the form uses, re-applied at the service boundary. */
function parse(values: CustomerFormValues): CustomerFormValues {
  const result = customerSchema.safeParse(values)
  if (!result.success) throw new CustomerRuleError(result.error.issues[0]?.message ?? 'Customer details are invalid.')
  return result.data
}

export const customerService = {
  list({ search, status, customerType, page, pageSize }: CustomerListQuery): CustomerListResult {
    const term = search.trim().toLowerCase()
    const matches = customerRepository.list().filter(item => {
      if (status && item.status !== status) return false
      if (customerType && item.customerType !== customerType) return false
      if (!term) return true
      const haystack = [item.fullName, item.mobile, item.email, ...item.addresses.flatMap(address => [address.pinCode, address.locality])].join(' ').toLowerCase()
      return haystack.includes(term)
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.fullName.localeCompare(b.fullName))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  /** Bounded lookup for the subscription customer selector. */
  searchActive(search: string, limit = 8): Customer[] {
    const term = search.trim().toLowerCase()
    return customerRepository.list()
      .filter(item => item.status === 'active' && (!term || [item.fullName, item.mobile, ...item.addresses.map(address => address.pinCode)].join(' ').toLowerCase().includes(term)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .slice(0, limit)
  },
  getById: (id: string) => customerRepository.get(id),
  listAll: () => customerRepository.list(),
  countByStatus: (status: CustomerStatus) => customerRepository.list().filter(item => item.status === status).length,
  create(values: CustomerFormValues): Customer {
    const input = toInput(parse(values))
    assertUniqueMobile(input.mobile)
    const created = customerRepository.insert(input)
    applyCustomerTypeChange(undefined, created.customerType, created.id)
    return created
  },
  update(id: string, values: CustomerFormValues): Customer {
    const existing = customerRepository.get(id)
    if (!existing) throw new CustomerRuleError('Customer not found.')
    const input = toInput(parse(values), existing)
    assertUniqueMobile(input.mobile, id)
    applyCustomerTypeChange(existing, input.customerType, id)
    const updated = customerRepository.replace(id, input)
    if (!updated) throw new CustomerRuleError('Customer not found.')
    return updated
  },
  setStatus(id: string, status: CustomerStatus): Customer {
    const existing = customerRepository.get(id)
    if (!existing) throw new CustomerRuleError('Customer not found.')
    const updated = customerRepository.replace(id, {
      fullName: existing.fullName, mobile: existing.mobile, email: existing.email, customerType: existing.customerType,
      addresses: existing.addresses, notes: existing.notes, status,
    })
    if (!updated) throw new CustomerRuleError('Customer not found.')
    return updated
  },
  activate: (id: string) => customerService.setStatus(id, 'active'),
  deactivate: (id: string) => customerService.setStatus(id, 'inactive'),
  /** What deactivating this customer leaves untouched, for the confirmation dialog. */
  deactivationImpact: (id: string) => ({ openSubscriptions: subscriptionRepository.countOpenByCustomer(id) }),
}
