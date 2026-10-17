import { SubscriptionAdminWorkspace } from '@/features/subscription-admin/SubscriptionAdminWorkspace'

export default async function SubscriptionsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <SubscriptionAdminWorkspace kind="subscription" segments={segments} />
}
