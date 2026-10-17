import type { MediaType } from './types'

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
/** Images up to this size keep a preview in the mock phase (browser storage is small). */
export const MAX_INLINE_PREVIEW_BYTES = 150 * 1024

export const ACCEPT_ATTRIBUTE = [...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES].join(',')

export function mediaTypeOf(mimeType: string): MediaType | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return 'image'
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType)) return 'document'
  return null
}

/** Returns a message when the file may not be added, otherwise null. The type is checked, not just the file name. */
export function fileProblem(file: { name: string; type: string; size: number }): string | null {
  const type = mediaTypeOf(file.type)
  if (!type) return 'Only JPG, PNG, WebP images and PDF documents can be added.'
  if (file.size <= 0) return 'This file is empty.'
  if (type === 'image' && file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.'
  if (type === 'document' && file.size > MAX_DOCUMENT_BYTES) return 'Documents must be 10 MB or smaller.'
  return null
}

export const formatFileSize = (bytes: number): string => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
