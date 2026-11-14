import { recordApi, type RecordStatus } from '../configuration/api'

export type CategoryRecord = {
  id: string; name: string; nameGu: string; description: string; sortOrder: number; status: RecordStatus; updatedAt: string
  /** The tile picture on the app's Home, if one was uploaded. */
  imageAssetId: string | null; imageUrl: string | null
}

/** Category calls to the backend. The server validates everything again; these never decide what is allowed. */
export const categoryApi = recordApi<CategoryRecord>('/admin/categories', 'category')
