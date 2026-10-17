import type { FieldErrors } from 'react-hook-form'
import type { ProductFormValues } from './schema'
import type { ProductStepId } from './components/ProductStepNavigation'

export type FormProblem = { path: string; message: string; step: ProductStepId }

/** The form step a field lives on, so a problem can take the admin straight to it. */
export function stepForField(path: string): ProductStepId {
  const root = path.split('.')[0] ?? ''
  if (root === 'content') return 'content'
  if (root === 'variants' || root === 'includeInProductionPlanning') return 'variants'
  if (['purchaseMethods', 'trialPlanIds', 'subscriptionRuleIds'].includes(root)) return 'selling'
  if (['deliveryMethod', 'serviceAreaId', 'cutoffRuleId'].includes(root)) return 'delivery'
  return 'basics'
}

/** Every message react-hook-form found, in form order, each with where it belongs. Nested fields and list rows are included. */
export function collectProblems(errors: FieldErrors<ProductFormValues>): FormProblem[] {
  const problems: FormProblem[] = []
  const visit = (node: unknown, path: string) => {
    if (typeof node !== 'object' || node === null) return
    const { message } = node as { message?: unknown }
    if (typeof message === 'string' && message) problems.push({ path, message, step: stepForField(path) })
    for (const [key, child] of Object.entries(node)) {
      if (key === 'ref' || key === 'message' || key === 'type') continue
      visit(child, path ? `${path}.${key}` : key)
    }
  }
  visit(errors, '')
  return problems
}
