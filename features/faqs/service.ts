import { faqRepository } from './mock-repository'
import { FAQ_TOPIC_LABELS, type Faq, type FaqInput } from './types'

export class FaqRuleError extends Error {}

const TOPIC_ORDER = Object.keys(FAQ_TOPIC_LABELS)
const sameQuestion = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const faqService = {
  /** Grouped the way the app shows them: by topic, then display order. */
  list: () => [...faqRepository.list()].sort((a, b) => TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic) || a.sortOrder - b.sortOrder || a.question.localeCompare(b.question)),
  getById: (id: string) => faqRepository.get(id),
  save(input: FaqInput): Faq {
    const question = input.question.trim()
    const answer = input.answer.trim()
    if (!question) throw new FaqRuleError('Enter the question.')
    if (!answer) throw new FaqRuleError('Enter the answer.')
    if (faqRepository.list().some(item => item.id !== input.id && item.topic === input.topic && sameQuestion(item.question, question))) throw new FaqRuleError('This question already exists under the same topic.')
    return faqRepository.save({ ...input, question, answer })
  },
  setStatus(id: string, status: Faq['status']) {
    if (!faqRepository.get(id)) throw new FaqRuleError('Question not found.')
    faqRepository.patch(id, { status })
  },
}
