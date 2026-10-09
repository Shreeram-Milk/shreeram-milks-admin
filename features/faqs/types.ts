export type FaqTopic = 'delivery' | 'subscription' | 'payments' | 'account' | 'other'

export const FAQ_TOPIC_LABELS: Record<FaqTopic, string> = { delivery: 'Delivery', subscription: 'Subscriptions', payments: 'Payments & refunds', account: 'Account', other: 'Other' }

/** A question and answer shown in the customer app's Help & Support screen. */
export type Faq = {
  id: string
  topic: FaqTopic
  question: string
  questionGujarati: string
  answer: string
  answerGujarati: string
  /** Lower numbers appear first within the topic. */
  sortOrder: number
  status: 'active' | 'inactive'
  updatedAt: string
}

export type FaqInput = Omit<Faq, 'id' | 'updatedAt'> & { id?: string }
