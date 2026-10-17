import { PaymentWorkspace } from '@/features/payment-admin/PaymentWorkspace'

export default async function OnlinePaymentsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <PaymentWorkspace segments={segments} />
}
