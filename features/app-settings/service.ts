import { readCollection, writeCollection } from '@/lib/mock-storage'
import type { AppSettings, AppSettingsInput } from './types'

const KEY = 'shreeram-admin-app-settings-v1'
const seed: AppSettings = {
  supportPhone: '', supportEmail: '', supportHours: 'Daily, 5:00 AM – 8:00 PM', supportHoursGujarati: '', deliveryPromise: 'Delivered before 7:00 AM', deliveryPromiseGujarati: '',
  minimumAppVersion: '1.0.0', maintenanceMode: false, maintenanceMessage: '', updatedAt: '2026-01-01T00:00:00.000Z',
}

export class AppSettingsRuleError extends Error {}

const parts = (version: string) => version.split('.').map(Number)

/** True when `version` is older than `minimum` (both x.y.z). */
export const isVersionBelow = (version: string, minimum: string): boolean => {
  const [a, b] = [parts(version), parts(minimum)]
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] < b[index]
  return false
}

export const appSettingsService = {
  get: () => readCollection<AppSettings>(KEY, seed),
  save(input: AppSettingsInput): AppSettings {
    if (!/^\d+\.\d+\.\d+$/.test(input.minimumAppVersion)) throw new AppSettingsRuleError('Use the version format 1.0.0.')
    if (input.maintenanceMode && !input.maintenanceMessage.trim()) throw new AppSettingsRuleError('Tell customers why the app is unavailable.')
    const record: AppSettings = { ...input, updatedAt: new Date().toISOString() }
    writeCollection(KEY, record)
    return record
  },
}
