export type CategoryStatus = 'active' | 'inactive'

export type Category = {
  id: string
  name: string
  nameGujarati: string
  description: string
  /** Lower numbers appear first in the customer app. */
  sortOrder: number
  status: CategoryStatus
  updatedAt: string
}

export type CategoryInput = Omit<Category, 'id' | 'updatedAt'> & { id?: string }
