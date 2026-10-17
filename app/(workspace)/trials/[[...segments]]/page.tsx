import { SubscriptionAdminWorkspace } from '@/features/subscription-admin/SubscriptionAdminWorkspace'

export default async function TrialsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <SubscriptionAdminWorkspace kind="trial" segments={segments} />
}
