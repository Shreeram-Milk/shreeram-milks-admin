import { EditBanner } from '@/features/banners/BannerEditor'

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EditBanner id={id} />
}
