import { TrialWorkspace } from '@/features/trials/TrialWorkspace'

export default async function TrialsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <TrialWorkspace segments={segments} />
}
