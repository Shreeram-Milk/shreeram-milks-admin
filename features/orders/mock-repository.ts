import { addDays, todayInBusinessZone } from '@/lib/business-time'
import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { Order, OrderItem } from './types'

const KEY = 'shreeram-admin-orders-v1'
const now = () => new Date().toISOString()

const address = { line1: 'B-14, Shanti Apartments', line2: 'Near Community Hall', locality: 'Sector 10', city: 'Gandhinagar', state: 'Gujarat', pinCode: '382010' }
function seedItem(orderId: string, id: string, productId: string, variantId: string, productName: string, variantName: string, sku: string, unit: number, quantity: number): OrderItem {
  return { id, orderId, productId, variantId, productNameSnapshot: productName, variantNameSnapshot: variantName, skuSnapshot: sku, unitPricePaiseSnapshot: unit, quantity, lineTotalPaise: unit * quantity }
}

/** Two starter orders dated relative to first use so the demo always has upcoming work. */
function seedOrders(): Order[] {
  const today = todayInBusinessZone()
  const stamp = now()
  const confirmedItems = [seedItem('order-seed-1', 'item-1', 'product-paneer', 'pan-500', 'Fresh Paneer', '500 g', '', 18000, 2)]
  const draftItems = [seedItem('order-seed-2', 'item-1', 'product-paneer', 'pan-1000', 'Fresh Paneer', '1 kg', '', 34000, 1)]
  return [
    { id: 'order-seed-1', orderNumber: 'ORD-1001', customerId: 'customer-rakesh', status: 'confirmed', orderType: 'buy_once', paymentMode: 'prepaid', fulfilmentProfileId: 'profile-gandhinagar', deliverySlotId: 'slot-morning', deliveryDate: addDays(today, 1), addressSnapshot: address, pincode: '382010', items: confirmedItems, subtotalPaise: 36000, adjustmentPaise: 0, totalPaise: 36000, cancellation: null, createdAt: stamp, updatedAt: stamp },
    { id: 'order-seed-2', orderNumber: 'ORD-1002', customerId: 'customer-meena', status: 'draft', orderType: 'buy_once', paymentMode: 'credit', fulfilmentProfileId: 'profile-gandhinagar', deliverySlotId: 'slot-morning', deliveryDate: addDays(today, 2), addressSnapshot: { ...address, locality: 'Sector 11', pinCode: '382011', line1: '22, Green Park Society', line2: '' }, pincode: '382011', items: draftItems, subtotalPaise: 34000, adjustmentPaise: 0, totalPaise: 34000, cancellation: null, createdAt: stamp, updatedAt: stamp },
  ]
}

const read = () => readCollection<Order[]>(KEY, seedOrders())
const write = (orders: Order[]) => writeCollection(KEY, orders)

export const orderRepository = {
  list: () => read(),
  get: (id: string) => read().find(order => order.id === id),
  listForCustomer: (customerId: string) => read().filter(order => order.customerId === customerId),
  /** Next friendly number after the highest existing one. */
  nextOrderNumber(): string {
    const highest = read().reduce((max, order) => Math.max(max, Number(order.orderNumber.replace(/\D/g, '')) || 0), 1000)
    return `ORD-${highest + 1}`
  },
  insert(order: Omit<Order, 'createdAt' | 'updatedAt'>): Order {
    const stamp = now()
    const created: Order = { ...order, createdAt: stamp, updatedAt: stamp }
    write([...read(), created])
    return created
  },
  replace(id: string, changes: Partial<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>): Order | undefined {
    let updated: Order | undefined
    write(read().map(order => order.id === id ? (updated = { ...order, ...changes, updatedAt: now() }) : order))
    return updated
  },
}
