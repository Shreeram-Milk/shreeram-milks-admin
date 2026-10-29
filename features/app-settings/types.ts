import { appSettingsMessages, t } from './messages'
/**
 * Switches for features the app already has. They show or hide an existing capability; they cannot add new
 * native functionality. WhatsApp is controlled in the Support section (`whatsappEnabled`), so it is not repeated here.
 * `chatEnabled` is still stored but has no switch: the app has no live chat yet, and a "coming soon" button gets store review flagged.
 */
export type FeatureFlags = {
  showTrials: boolean
  showSubscriptions: boolean
  showOffers: boolean
  showQualityReports: boolean
  showSeasonalBanner: boolean
}

type FlagKey = keyof typeof appSettingsMessages.en
// The words are read when used, so they follow the admin's language.
const flag = (label: FlagKey, detail: FlagKey) => ({ get label() { return t(label) }, get detail() { return t(detail) } })
export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, { readonly label: string; readonly detail: string }> = {
  showTrials: flag('flagTrials', 'flagTrialsDetail'),
  showSubscriptions: flag('flagSubscriptions', 'flagSubscriptionsDetail'),
  showOffers: flag('flagOffers', 'flagOffersDetail'),
  showQualityReports: flag('flagQuality', 'flagQualityDetail'),
  showSeasonalBanner: flag('flagBanners', 'flagBannersDetail'),
}
export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAG_LABELS) as Array<keyof FeatureFlags>

/** Content and switches the customer app reads at start-up. One record for the whole business. */
export type AppSettings = {
  supportPhone: string
  supportEmail: string
  supportWhatsApp: string
  callEnabled: boolean
  chatEnabled: boolean
  whatsappEnabled: boolean
  supportHoursEn: string
  supportHoursGu: string
  afterHoursMessageEn: string
  afterHoursMessageGu: string
  deliveryPromiseEn: string
  deliveryPromiseGu: string
  /** Oldest app version allowed to run; older versions are asked to update. */
  minimumAppVersion: string
  maintenanceMode: boolean
  maintenanceMessageEn: string
  maintenanceMessageGu: string
  /** Show the support contact on the maintenance screen. */
  showMaintenanceContact: boolean
  flags: FeatureFlags
  updatedAt: string
}

export type AppSettingsInput = Omit<AppSettings, 'updatedAt'>
