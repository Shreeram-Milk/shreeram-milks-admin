import { SubscriptionWorkspace } from '@/features/subscriptions/SubscriptionWorkspace'

export default async function SubscriptionsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <SubscriptionWorkspace segments={segments} />
}
