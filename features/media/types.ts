export type MediaType = 'image' | 'document'

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = { image: 'Image', document: 'Document' }

/** A file in the shared library, reused by banners, products, onboarding, quality reports and more. */
export type MediaAsset = {
  id: string
  type: MediaType
  /** The name the file had when it was added; never edited. */
  fileName: string
  /** The name staff see and search by. */
  displayName: string
  mimeType: string
  fileSizeBytes: number
  /**
   * Where the file is served from. In this mock phase small images are kept as data URLs and everything else
   * gets a `mock://` address with no preview. A real build replaces both with an uploaded file's URL.
   */
  url: string
  altTextEn: string
  altTextGu: string
  createdAt: string
  updatedAt: string
}

export type MediaAssetInput = Omit<MediaAsset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

/** One place an asset is used, so deleting it can be blocked with a clear explanation. */
export type MediaReference = { feature: string; label: string; href: string }
