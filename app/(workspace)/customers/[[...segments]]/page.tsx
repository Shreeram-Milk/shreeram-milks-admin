import { CustomerWorkspace } from '@/features/customers/CustomerWorkspace'

export default async function CustomersPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <CustomerWorkspace segments={segments} />
}
