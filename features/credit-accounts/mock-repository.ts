import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { CreditAccount, CreditLedgerEntry } from './types'

const ACCOUNTS_KEY = 'shreeram-admin-credit-accounts-v1'
const LEDGER_KEY = 'shreeram-admin-credit-ledger-v1'
const now = () => new Date().toISOString()

const readAccounts = () => readCollection<CreditAccount[]>(ACCOUNTS_KEY, [])
const readLedger = () => readCollection<CreditLedgerEntry[]>(LEDGER_KEY, [])

/** Append-only for the ledger: there is deliberately no update or delete for entries. */
export const creditAccountRepository = {
  listAccounts: () => readAccounts(),
  getByCustomer: (customerId: string) => readAccounts().find(item => item.customerId === customerId),
  /** Returns the customer's account, creating it once if it does not exist. */
  ensure(customerId: string): CreditAccount {
    const accounts = readAccounts()
    const existing = accounts.find(item => item.customerId === customerId)
    if (existing) return existing
    const stamp = now()
    const created: CreditAccount = { id: `credit-account-${customerId}`, customerId, status: 'active', billingCycle: 'monthly', creditLimitPaise: null, createdAt: stamp, updatedAt: stamp }
    writeCollection(ACCOUNTS_KEY, [...accounts, created])
    return created
  },
  updateAccount(customerId: string, changes: Partial<Pick<CreditAccount, 'status' | 'creditLimitPaise'>>): CreditAccount | undefined {
    let updated: CreditAccount | undefined
    writeCollection(ACCOUNTS_KEY, readAccounts().map(item => item.customerId === customerId ? (updated = { ...item, ...changes, updatedAt: now() }) : item))
    return updated
  },
  listEntries: () => readLedger(),
  listEntriesForCustomer: (customerId: string) => readLedger().filter(item => item.customerId === customerId),
  findEntry: (type: CreditLedgerEntry['type'], referenceType: CreditLedgerEntry['referenceType'], referenceId: string) =>
    readLedger().find(item => item.type === type && item.referenceType === referenceType && item.referenceId === referenceId),
  /** Appends entries; an entry whose id already exists is ignored, which is what makes posting idempotent. */
  append(entries: Omit<CreditLedgerEntry, 'createdAt'>[]): CreditLedgerEntry[] {
    const rows = readLedger()
    const known = new Set(rows.map(row => row.id))
    const stamp = now()
    const added: CreditLedgerEntry[] = []
    for (const entry of entries) {
      if (known.has(entry.id)) continue
      known.add(entry.id)
      added.push({ ...entry, createdAt: stamp })
    }
    if (added.length) writeCollection(LEDGER_KEY, [...rows, ...added])
    return added
  },
  countPayments: () => readLedger().filter(item => item.type === 'payment_received').length,
}
