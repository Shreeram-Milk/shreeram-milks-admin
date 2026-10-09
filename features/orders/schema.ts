import { z } from 'zod'
import { isIsoDate, type IsoDate } from '@/lib/business-time'
import { MAX_ITEM_QUANTITY } from './pricing'

const MAX_ITEMS = 20

/** Field-level rules only; serviceability, slots and pricing are decided by the order service. */
export function buildOrderSchema({ today, originalDate }: { today: IsoDate; originalDate?: IsoDate | null }) {
  return z.object({
    customerId: z.string().min(1, 'Select a customer.'),
    items: z.array(z.object({
      id: z.string().optional(),
      productId: z.string().min(1, 'Select a product.'),
      variantId: z.string().min(1, 'Select a variant.'),
      quantity: z.number({ error: 'Enter a quantity.' }).int('Quantity must be a whole number.').min(1, 'Quantity must be at least 1.').max(MAX_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_ITEM_QUANTITY}.`),
    })).min(1, 'Add at least one item.').max(MAX_ITEMS, `An order can have at most ${MAX_ITEMS} items.`),
    deliverySlotId: z.string(),
    deliveryDate: z.string().min(1, 'Choose a delivery date.'),
  }).superRefine((value, context) => {
    if (value.deliveryDate && !isIsoDate(value.deliveryDate)) context.addIssue({ code: 'custom', path: ['deliveryDate'], message: 'Choose a valid delivery date.' })
    else if (value.deliveryDate && value.deliveryDate !== originalDate && value.deliveryDate < today) context.addIssue({ code: 'custom', path: ['deliveryDate'], message: 'The delivery date cannot be in the past.' })
  })
}
export type OrderFormValues = z.infer<ReturnType<typeof buildOrderSchema>>
