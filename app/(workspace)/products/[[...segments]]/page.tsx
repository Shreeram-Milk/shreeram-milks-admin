import { ProductWorkspace } from '@/features/products/ProductWorkspace'

export default async function ProductsPage({ params }: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await params
  return <ProductWorkspace segments={segments} />
}
