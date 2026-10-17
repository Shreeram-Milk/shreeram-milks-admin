export type OnboardingStatus = 'active' | 'inactive'

/** One screen of the customer app's first-run introduction. */
export type OnboardingSlide = {
  id: string
  imageAssetId: string
  titleEn: string
  titleGu: string
  descriptionEn: string
  descriptionGu: string
  /** Lower numbers appear first. Kept consecutive (1, 2, 3...) by reordering. */
  sortOrder: number
  status: OnboardingStatus
  createdAt: string
  updatedAt: string
}

export type OnboardingSlideInput = Omit<OnboardingSlide, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }

/** The introduction stays short; more than this and people skip it. */
export const MAX_ACTIVE_SLIDES = 5

/** What the form sends to the backend. The backend numbers the slides and keeps the order. */
export type OnboardingSlideFields = Pick<OnboardingSlide, 'imageAssetId' | 'titleEn' | 'titleGu' | 'descriptionEn' | 'descriptionGu' | 'status'>

/** A slide as the backend returns it: the picture arrives as a short-lived link. */
export type OnboardingSlideRecord = OnboardingSlide & { imageUrl: string | null }
