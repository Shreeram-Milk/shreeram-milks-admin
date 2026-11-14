import { WalletWorkspace } from '@/features/wallet-admin/WalletWorkspace'

export default async function WalletsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <WalletWorkspace segments={segments} />
}
