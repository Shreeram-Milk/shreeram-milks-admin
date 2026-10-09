import { CreditAccountsWorkspace } from '@/features/credit-accounts/CreditAccountsWorkspace'

export default async function CreditAccountsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <CreditAccountsWorkspace segments={segments} />
}
