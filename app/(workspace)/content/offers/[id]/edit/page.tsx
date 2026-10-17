import { EditOffer } from '@/features/offers/OfferEditor'

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditOffer id={id} />
}
