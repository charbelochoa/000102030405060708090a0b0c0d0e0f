import type { Model, Usage } from '../shared/types'

export function calculateCost(usage: Usage, model: Model, freeTier = false): bigint {
  if (freeTier) return 0n
  const rate = (value: number) => BigInt(Math.round(value * 1_000_000))
  const fresh = Math.max(0, usage.input - usage.cached - usage.cacheWrite)
  const pico =
    BigInt(fresh) * rate(model.inputPrice) +
    BigInt(usage.cached) * rate(model.cachedPrice) +
    BigInt(usage.cacheWrite) * rate(model.cacheWritePrice) +
    BigInt(usage.output) * rate(model.outputPrice)
  return (pico + 500n) / 1000n
}

export function normalizeUsage(
  raw: Record<string, any> | undefined,
  anthropic = false
): Usage | null {
  if (!raw) return null
  if (
    !Number.isSafeInteger(raw.prompt_tokens ?? raw.input_tokens) ||
    !Number.isSafeInteger(raw.completion_tokens ?? raw.output_tokens)
  )
    return null
  const n = (v: unknown) => (Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : 0)
  const cached = n(
    raw.prompt_tokens_details?.cached_tokens ??
      raw.cache_read_input_tokens ??
      raw.prompt_cache_hit_tokens
  )
  const cacheWrite = n(raw.cache_creation_input_tokens)
  const input = anthropic
    ? n(raw.input_tokens) + cached + cacheWrite
    : n(raw.prompt_tokens ?? raw.input_tokens)
  const output = n(raw.completion_tokens ?? raw.output_tokens)
  const reasoning =
    raw.completion_tokens_details?.reasoning_tokens ?? raw.output_tokens_details?.reasoning_tokens
  return {
    input,
    output,
    cached: Math.min(input, cached),
    cacheWrite: Math.min(Math.max(0, input - cached), cacheWrite),
    reasoning: Number.isSafeInteger(reasoning) ? n(reasoning) : null
  }
}

export function shouldStop(
  scores: number[],
  cost: bigint,
  options: {
    budget: number
    maxIterations: number
    target: number
    patience: number
    minDelta: number
  }
): 'target' | 'budget' | 'iterations' | 'plateau' | undefined {
  if (cost >= BigInt(Math.round(options.budget * 1e9))) return 'budget'
  if (scores.at(-1) !== undefined && scores.at(-1)! >= options.target) return 'target'
  if (scores.length >= options.maxIterations) return 'iterations'
  if (scores.length > options.patience) {
    const recent = scores.slice(-options.patience - 1)
    if (Math.max(...recent.slice(1)) - recent[0] < options.minDelta) return 'plateau'
  }
}
