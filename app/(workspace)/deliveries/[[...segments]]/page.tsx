import { DeliveryWorkspace } from '@/features/deliveries/DeliveryWorkspace'

export default async function DeliveriesPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <DeliveryWorkspace segments={segments} />
}
