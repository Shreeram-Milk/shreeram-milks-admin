/**
 * Switches for features the app already has. They show or hide an existing capability; they cannot add new
 * native functionality. Support chat and WhatsApp are controlled in the Support section (`chatEnabled`,
 * `whatsappEnabled`), so they are not repeated here.
 */
export type FeatureFlags = {
  showTrials: boolean
  showSubscriptions: boolean
  showOffers: boolean
  showQualityReports: boolean
  showSeasonalBanner: boolean
}

export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, { label: string; detail: string }> = {
  showTrials: { label: 'Trial packs', detail: 'Lets customers start a trial from a product page.' },
  showSubscriptions: { label: 'Subscriptions', detail: 'Lets customers subscribe, and shows the Subscriptions tab.' },
  showOffers: { label: 'Offers and discounts', detail: 'Shows offers and discount lines in the app.' },
  showQualityReports: { label: 'Quality reports', detail: 'Shows lab reports and certificates.' },
  showSeasonalBanner: { label: 'Home banners', detail: 'Shows promotions and notices on the home screen.' },
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
