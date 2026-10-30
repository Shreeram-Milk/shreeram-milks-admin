import { apiRequest } from '@/lib/api-client'

export type OrderCounts = { placed: number; out_for_delivery: number; delivered: number; missed: number; cancelled: number }
/** Orders placed and their value on one India day. Cancelled orders are not sales. */
export type TrendDay = { date: string; orders: number; revenuePaise: number }
export type WindowProgress = { slotId: string; name: string; startTime: string; endTime: string; total: number; delivered: number; outForDelivery: number; missed: number }
export type TopProduct = { name: string; quantity: number; revenuePaise: number }
export type RecentOrder = { id: string; orderNumber: string; customerName: string; totalPaise: number; status: string; placedAt: string }

/** The landing page's numbers, all counted by the server for the India day. */
export type DashboardData = {
  today: string
  tomorrow: string
  deliveries: { today: OrderCounts; todayTotal: number; tomorrowTotal: number }
  plans: { subscriptions: number; trials: number }
  money: { owedPaise: number; owingCustomers: number; refundsToSend: number; refundsToSendPaise: number; paidOnlineTodayPaise: number }
  customers: { active: number; newThisWeek: number; newPreviousWeek: number }
  sales: { todayPaise: number; yesterdayPaise: number; todayOrders: number; yesterdayOrders: number; last7Paise: number; previous7Paise: number; last7Orders: number; previous7Orders: number; trend: TrendDay[] }
  deliveryQuality: { delivered7: number; missed7: number }
  windows: WindowProgress[]
  topProducts: TopProduct[]
  recentOrders: RecentOrder[]
  attention: { creditLimitSkips: number; overdueOrders: number; openTickets: number }
}

export const dashboardApi = { get(): Promise<DashboardData> { return apiRequest<DashboardData>('/admin/dashboard') } }
