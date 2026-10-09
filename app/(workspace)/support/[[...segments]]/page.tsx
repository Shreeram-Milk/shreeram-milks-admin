import { SupportWorkspace } from '@/features/support-tickets/SupportWorkspace'

export default async function SupportPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <SupportWorkspace segments={segments} />
}
