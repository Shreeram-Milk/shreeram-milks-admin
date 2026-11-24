/** Optional customer-confirmed directions. Missing fields stay missing; never infer floor or tower from a unit number. */
export type DeliveryDetails = Partial<Record<'building' | 'towerWing' | 'floor' | 'unit' | 'lane', string>>
