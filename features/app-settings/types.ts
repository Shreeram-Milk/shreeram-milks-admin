/** Content and switches the customer app reads at start-up. One record for the whole business. */
export type AppSettings = {
  supportPhone: string
  supportEmail: string
  supportHours: string
  supportHoursGujarati: string
  deliveryPromise: string
  deliveryPromiseGujarati: string
  /** Oldest app version allowed to run; older versions are asked to update. */
  minimumAppVersion: string
  maintenanceMode: boolean
  maintenanceMessage: string
  updatedAt: string
}

export type AppSettingsInput = Omit<AppSettings, 'updatedAt'>
