import { fileProblem, formatFileSize, MAX_INLINE_PREVIEW_BYTES, mediaTypeOf } from './rules'
import { mediaRepository } from './mock-repository'
import { referencesTo } from './references'
import type { MediaAsset, MediaReference, MediaType } from './types'

export class MediaRuleError extends Error {}

export type MediaListQuery = { search: string; type: MediaType | ''; page: number; pageSize: number }
export type MediaMetadata = { displayName: string; altTextEn: string; altTextGu: string }
export type NewMedia = MediaMetadata & { fileName: string; mimeType: string; fileSizeBytes: number; /** Present only for small images; see `MediaAsset.url`. */ previewUrl?: string }

const MAX_NAME = 80
const MAX_ALT = 160

function checkMetadata({ displayName, altTextEn, altTextGu }: MediaMetadata) {
  if (!displayName.trim()) throw new MediaRuleError('Enter a name for this file.')
  if (displayName.trim().length > MAX_NAME) throw new MediaRuleError(`Keep the name under ${MAX_NAME + 1} characters.`)
  if (altTextEn.length > MAX_ALT || altTextGu.length > MAX_ALT) throw new MediaRuleError(`Keep the description under ${MAX_ALT + 1} characters.`)
}

export const mediaService = {
  list({ search, type, page, pageSize }: MediaListQuery): { rows: MediaAsset[]; total: number } {
    const term = search.trim().toLowerCase()
    const matches = mediaRepository.list()
      .filter(asset => (!type || asset.type === type) && (!term || `${asset.displayName} ${asset.fileName} ${asset.altTextEn}`.toLowerCase().includes(term)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.displayName.localeCompare(b.displayName))
    return { rows: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length }
  },
  getById: (id: string) => mediaRepository.get(id),
  /** Name lookup for places that show a chosen asset. */
  nameOf: (id: string) => mediaRepository.get(id)?.displayName ?? '',
  /** Choices for a picker; `type` limits it to images or documents. */
  options(type?: MediaType): Array<{ value: string; label: string }> {
    return mediaRepository.list().filter(asset => !type || asset.type === type).sort((a, b) => a.displayName.localeCompare(b.displayName)).map(asset => ({ value: asset.id, label: asset.displayName }))
  },
  references: (id: string): MediaReference[] => referencesTo(id),
  /** Adds a file to the library. Checks the declared type and size; a real upload replaces only how `url` is produced. */
  add(input: NewMedia): MediaAsset {
    const problem = fileProblem({ name: input.fileName, type: input.mimeType, size: input.fileSizeBytes })
    if (problem) throw new MediaRuleError(problem)
    checkMetadata(input)
    const type = mediaTypeOf(input.mimeType) as MediaType
    const canPreview = type === 'image' && Boolean(input.previewUrl) && input.fileSizeBytes <= MAX_INLINE_PREVIEW_BYTES
    return mediaRepository.save({
      type, fileName: input.fileName, displayName: input.displayName.trim(), mimeType: input.mimeType, fileSizeBytes: input.fileSizeBytes,
      url: canPreview ? input.previewUrl as string : `mock://${encodeURIComponent(input.fileName)}`, altTextEn: input.altTextEn.trim(), altTextGu: input.altTextGu.trim(),
    })
  },
  update(id: string, metadata: MediaMetadata): MediaAsset {
    const asset = mediaRepository.get(id)
    if (!asset) throw new MediaRuleError('File not found.')
    checkMetadata(metadata)
    return mediaRepository.save({ ...asset, displayName: metadata.displayName.trim(), altTextEn: metadata.altTextEn.trim(), altTextGu: metadata.altTextGu.trim() })
  },
  /** Refuses while anything still uses the file, naming each place so staff know what to change first. */
  remove(id: string) {
    const asset = mediaRepository.get(id)
    if (!asset) throw new MediaRuleError('File not found.')
    const used = referencesTo(id)
    if (used.length) throw new MediaRuleError(`“${asset.displayName}” is used by ${used.map(item => `${item.feature} “${item.label}”`).join(', ')}. Remove it from there first.`)
    mediaRepository.remove(id)
  },
  describeSize: formatFileSize,
}
