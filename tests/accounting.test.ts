import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateCost, normalizeUsage, shouldStop } from '../server/accounting'
import { catalog } from '../shared/catalog'

test('prices input, cached input and output independently in integer nano USD', () => {
  const model = catalog.find((m) => m.id === 'gpt-5.4-mini')!
  const usage = { input: 1000, output: 200, cached: 400, cacheWrite: 0, reasoning: 80 }
  assert.equal(calculateCost(usage, model), 600n * 750n + 400n * 75n + 200n * 4500n)
  assert.equal(calculateCost(usage, model, true), 0n)
})

test('Anthropic cache buckets are added once and reasoning is not invented', () => {
  const usage = normalizeUsage(
    {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 50
    },
    true
  )!
  assert.equal(usage.input, 350)
  assert.equal(usage.cached, 200)
  assert.equal(usage.cacheWrite, 50)
  assert.equal(usage.reasoning, null)
  const model = catalog.find((m) => m.id === 'claude-haiku-4-5')!
  assert.equal(calculateCost(usage, model), 100n * 1000n + 200n * 100n + 50n * 1250n + 20n * 5000n)
})

test('unreported usage stays unknown; cached tokens cannot exceed input', () => {
  assert.equal(normalizeUsage(undefined), null)
  assert.equal(normalizeUsage({}), null)
  assert.equal(
    normalizeUsage({
      prompt_tokens: 10,
      completion_tokens: 2,
      prompt_tokens_details: { cached_tokens: 50 }
    })?.cached,
    10
  )
  assert.equal(normalizeUsage({ prompt_tokens: 10, completion_tokens: 2 })?.reasoning, null)
})

test('stops at budget, target, iteration limit and plateau', () => {
  const options = { budget: 0.1, target: 90, maxIterations: 8, patience: 3, minDelta: 1 }
  assert.equal(shouldStop([70], 100_000_000n, options), 'budget')
  assert.equal(shouldStop([70, 91], 0n, options), 'target')
  assert.equal(shouldStop([10, 20, 30, 40, 50, 60, 70, 80], 0n, options), 'iterations')
  assert.equal(shouldStop([70, 70.2, 70.4, 70.5], 0n, options), 'plateau')
  assert.equal(shouldStop([50, 60, 70, 80], 0n, options), undefined)
})
