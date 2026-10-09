import { windowError } from '@/lib/active-window'
import { formatINR, isValidPaise } from '@/lib/money'
import { offerRepository } from './mock-repository'
import type { Offer, OfferInput } from './types'

export class OfferRuleError extends Error {}

const sameCode = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

export const offerService = {
  list: () => [...offerRepository.list()].sort((a, b) => a.name.localeCompare(b.name)),
  getById: (id: string) => offerRepository.get(id),
  /** "10% off" / "₹50.00 off". */
  describeValue: (offer: Pick<Offer, 'discountType' | 'value'>) => offer.discountType === 'percent' ? `${offer.value}% off` : `${formatINR(offer.value)} off`,
  save(input: OfferInput): Offer {
    const name = input.name.trim()
    if (!name) throw new OfferRuleError('Enter an offer name.')
    if (!Number.isInteger(input.value) || input.value <= 0) throw new OfferRuleError('Enter a discount greater than zero.')
    if (input.discountType === 'percent' && input.value > 100) throw new OfferRuleError('A percentage discount cannot be more than 100%.')
    if (input.discountType === 'flat' && !isValidPaise(input.value)) throw new OfferRuleError('Enter a valid discount amount.')
    if (!isValidPaise(input.minOrderPaise) || input.minOrderPaise < 0) throw new OfferRuleError('Enter a valid minimum order amount.')
    const range = windowError(input.startDate, input.endDate)
    if (range) throw new OfferRuleError(range)
    const code = input.code.trim().toUpperCase()
    if (code && offerRepository.list().some(item => item.id !== input.id && sameCode(item.code, code))) throw new OfferRuleError(`The code ${code} is already used by another offer.`)
    return offerRepository.save({ ...input, name, code })
  },
  setStatus(id: string, status: Offer['status']) {
    if (!offerRepository.get(id)) throw new OfferRuleError('Offer not found.')
    offerRepository.patch(id, { status })
  },
}
