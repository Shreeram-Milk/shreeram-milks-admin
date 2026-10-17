import { CreditWorkspace } from '@/features/credit-admin/CreditWorkspace'

export default async function CreditAccountsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <CreditWorkspace segments={segments} />
}
