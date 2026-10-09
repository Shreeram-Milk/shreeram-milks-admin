import { ConfigurationWorkspace } from '@/features/configuration/ConfigurationWorkspace'

export default async function OperationsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <ConfigurationWorkspace segments={segments} section="operations" />
}
