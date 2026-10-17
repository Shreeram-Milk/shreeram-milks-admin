import { ApiError, apiRequest } from './api-client'

/** `banner` = a promotion photo, `banner_icon` = a small SVG on a notice, `onboarding` = a first-run slide picture, `product` = a photo of something you sell. */
export type MediaPurpose = 'banner' | 'banner_icon' | 'onboarding' | 'product'

const KB = 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** What each purpose accepts. The backend checks the same rules again, so these only give instant feedback. */
export const MEDIA_RULES: Record<MediaPurpose, { types: string[]; maxBytes: number; typeMessage: string; sizeMessage: string }> = {
  banner: { types: PHOTO_TYPES, maxBytes: 2 * KB * KB, typeMessage: 'Use a JPEG, PNG or WebP picture.', sizeMessage: 'Keep the picture under 2 MB.' },
  product: { types: PHOTO_TYPES, maxBytes: 2 * KB * KB, typeMessage: 'Use a JPEG, PNG or WebP picture.', sizeMessage: 'Keep the picture under 2 MB.' },
  onboarding: { types: PHOTO_TYPES, maxBytes: 2 * KB * KB, typeMessage: 'Use a JPEG, PNG or WebP picture.', sizeMessage: 'Keep the picture under 2 MB.' },
  banner_icon: { types: ['image/svg+xml'], maxBytes: 100 * KB, typeMessage: 'Icons must be SVG files.', sizeMessage: 'Keep the icon under 100 KB.' },
}

/** A photo picked from a phone camera can be several MB. It is shrunk before upload, so the limit on what can be picked is generous. */
const MAX_PICKED_PHOTO_BYTES = 15 * KB * KB
/** The longest side a stored photo keeps. Bigger originals are scaled down; the app never shows more than this. */
const MAX_SIDE: Record<MediaPurpose, number> = { banner: 1600, product: 1200, onboarding: 1200, banner_icon: 0 }
const WEBP_QUALITY = 0.82

const isPhoto = (purpose: MediaPurpose) => purpose !== 'banner_icon'

/** A plain-language reason a file cannot be used for this purpose, or null when it is fine. */
export function imageProblem(file: Pick<File, 'type' | 'size'>, purpose: MediaPurpose): string | null {
  const rule = MEDIA_RULES[purpose]
  if (!rule.types.includes(file.type)) return rule.typeMessage
  if (file.size === 0) return 'That file is empty.'
  if (file.size > (isPhoto(purpose) ? MAX_PICKED_PHOTO_BYTES : rule.maxBytes)) return isPhoto(purpose) ? 'Choose a picture under 15 MB.' : rule.sizeMessage
  return null
}

/** The size a picture is drawn at so its longest side is at most `max`, never enlarging it. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * Shrinks a photo in the browser before it is sent: scaled to a sensible size and saved as WebP. This keeps uploads fast and
 * storage small, and the server and database never do any image work. If the browser cannot do it, or the result is not smaller,
 * the original is sent unchanged.
 */
export async function compressPhoto(file: File, purpose: MediaPurpose): Promise<File> {
  if (!isPhoto(purpose)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE[purpose])
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' })
  } catch {
    return file
  }
}

type UploadStart = { asset: { id: string }; upload: { url: string; headers: Record<string, string> } }

/**
 * Shrinks a photo, then sends it to private storage in three steps: ask the backend for a one-time link, send the file straight
 * to storage with it, then tell the backend it arrived so it can check. Resolves with the file's id.
 */
export async function uploadImage(picked: File, purpose: MediaPurpose): Promise<string> {
  const problem = imageProblem(picked, purpose)
  if (problem) throw new ApiError(400, 'INVALID_IMAGE', problem)
  const file = await compressPhoto(picked, purpose)
  // The stored picture must fit the server's limit; a photo that is still too large after shrinking is refused here with a clear message.
  if (file.size > MEDIA_RULES[purpose].maxBytes) throw new ApiError(400, 'INVALID_IMAGE', MEDIA_RULES[purpose].sizeMessage)
  const { asset, upload } = await apiRequest<UploadStart>('/admin/media/uploads', { method: 'POST', body: { purpose, contentType: file.type, sizeBytes: file.size } })
  let response: Response
  try {
    // Storage is a different site from the backend, so the sign-in cookie must not be sent to it.
    response = await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: file, credentials: 'omit' })
  } catch {
    throw new ApiError(0, 'UPLOAD_FAILED', 'The file could not be sent to storage.')
  }
  if (!response.ok) throw new ApiError(response.status, 'UPLOAD_FAILED', 'Storage refused the file.')
  await apiRequest(`/admin/media/${asset.id}/complete`, { method: 'POST' })
  return asset.id
}
