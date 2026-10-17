import { OrderWorkspace } from '@/features/order-admin/OrderWorkspace'

export default async function OrdersPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <OrderWorkspace segments={segments} />
}
