import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import refund from './tours/flow-cancelled.json'
import scratch from './tours/flow-scratch-cards.json'
import { DEMO_PAGES, REFUND_EXAMPLE, SCRATCH_EXAMPLE, type DemoStage } from './workflow-demo/model'

const flows = { 'flow-cancelled': refund, 'flow-scratch-cards': scratch }
describe('complete Gujarati workflow demonstrations', () => {
  for (const [name, flow] of Object.entries(flows)) {
    it(`${name}: every step uses an isolated scene on its correct route`, () => {
      const ids = new Set<string>()
      for (const step of flow.steps) {
        assert.ok(!ids.has(step.id), `Repeated step: ${step.id}`)
        ids.add(step.id)
        assert.ok(step.demo in DEMO_PAGES, `Unknown scene: ${step.demo}`)
        assert.equal(step.page, DEMO_PAGES[step.demo as DemoStage])
        assert.match(step.target, /^css:\[data-demo="[a-z-]+"\]$/)
        assert.match(step.text, /[\u0A80-\u0AFF]/)
        assert.ok(step.text.length <= 2500)
        // Money/saving examples must never use the generic engine to press or fill a live business control.
        assert.ok(!('open' in step))
        assert.ok(!('fill' in step))
      }
      assert.ok(new Set(flow.steps.map(step => step.page)).size >= 3)
    })

    it(`${name}: every sentence has a matching generated voice clip`, () => {
      const folder = join(process.cwd(), 'public', 'tours', name)
      const index = JSON.parse(readFileSync(join(folder, 'index.json'), 'utf8')) as Record<string, string>
      assert.deepEqual(Object.keys(index).sort(), flow.steps.map(step => step.id).sort())
      for (const step of flow.steps) {
        const voice = Object.assign({ model: 'bulbul:v3', speaker: 'shubh', pace: 0.95 }, flow.voice)
        const hash = createHash('sha1').update(JSON.stringify([step.text, voice])).digest('hex').slice(0, 8)
        assert.equal(index[step.id], `${step.id}-${hash}.mp3`, `Stale audio for ${step.id}`)
        const file = join(folder, index[step.id]!)
        assert.ok(existsSync(file), `Missing clip: ${file}`)
        assert.ok(readFileSync(file).length > 1000, `Empty clip: ${file}`)
      }
    })
  }

  it('refund review and verification precede confirmation, completion and the accounting record', () => {
    const stages = refund.steps.map(step => step.demo)
    const order = ['refund-order', 'refund-owed', 'refund-review', 'refund-verify', 'refund-confirm', 'refund-pending', 'refund-completed', 'refund-ledger']
    for (let i = 1; i < order.length; i++) assert.ok(stages.indexOf(order[i - 1]!) < stages.indexOf(order[i]!))
    assert.equal(REFUND_EXAMPLE.paidPaise - REFUND_EXAMPLE.refundPaise, 0)
  })

  it('scratch cards cover setup, offer attachment, delivery, reveal, redemption and admin totals', () => {
    const stages = scratch.steps.map(step => step.demo)
    const order = ['scratch-settings-save', 'scratch-offer-details', 'scratch-code', 'scratch-purchases', 'scratch-pool', 'scratch-owner', 'scratch-offer-save', 'scratch-delivery', 'scratch-card', 'scratch-reveal', 'scratch-checkout', 'scratch-stats']
    for (let i = 1; i < order.length; i++) assert.ok(stages.indexOf(order[i - 1]!) < stages.indexOf(order[i]!))
    assert.ok(SCRATCH_EXAMPLE.qualifyingOrderPaise >= SCRATCH_EXAMPLE.minOrderPaise)
    assert.ok(SCRATCH_EXAMPLE.nextOrderPaise >= SCRATCH_EXAMPLE.minOrderPaise)
    assert.equal(SCRATCH_EXAMPLE.nextOrderPaise - SCRATCH_EXAMPLE.discountPaise, SCRATCH_EXAMPLE.finalPaise)
  })
})
