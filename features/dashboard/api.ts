import { apiRequest } from '@/lib/api-client'

export type OrderCounts = { placed: number; out_for_delivery: number; delivered: number; missed: number; cancelled: number }

/** The landing page's numbers, all counted by the server for the India day. */
export type DashboardData = {
  today: string
  tomorrow: string
  deliveries: { today: OrderCounts; todayTotal: number; tomorrowTotal: number }
  plans: { subscriptions: number; trials: number }
  money: { owedPaise: number; owingCustomers: number; refundsToSend: number; refundsToSendPaise: number; paidOnlineTodayPaise: number }
  customers: { active: number; newThisWeek: number }
  attention: { creditLimitSkips: number; overdueOrders: number; openTickets: number }
}

export const dashboardApi = { get(): Promise<DashboardData> { return apiRequest<DashboardData>('/admin/dashboard') } }
