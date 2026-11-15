import { redirect } from 'next/navigation'
import { WalletWorkspace } from '@/features/wallet-admin/WalletWorkspace'
import { WALLET_ON } from '@/lib/features'

export default async function WalletsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  // While the wallet is switched off, its pages lead back to Money.
  if (!WALLET_ON) redirect('/prepaid-adjustments')
  const { segments = [] } = await params
  return <WalletWorkspace segments={segments} />
}
