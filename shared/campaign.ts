import type { Policy, SearchMode, Study, Trial } from './analysis'

import { teamStrategies } from './analysis'
export interface CampaignOptions {
  teams?: boolean
  mode: SearchMode
  generations: number
  budget: number
  maxUsd: number
}
type Request = <T>(path: string, body?: unknown) => Promise<T>
interface State {
  active: string
  candidate?: string
  sealed: boolean
  policies: { id: string; proposal?: { mode: SearchMode } }[]
  cases: { id: string; split: string; verifiedDev?: boolean }[]
}
export async function runCampaign(
  request: Request,
  options: CampaignOptions,
  progress?: (message: string) => void,
  signal?: AbortSignal
) {
  const { generations, budget, maxUsd, mode } = options
  if (
    !Number.isInteger(generations) ||
    generations < 1 ||
    generations > 50 ||
    !Number.isFinite(budget) ||
    budget <= 0 ||
    budget > 5 ||
    !Number.isFinite(maxUsd) ||
    maxUsd < budget ||
    !['static', 'adaptive'].includes(mode)
  )
    throw new Error('Revisa generaciones, modo y presupuesto.')
  const limit = BigInt(Math.round(maxUsd * 1e9)),
    reserve = BigInt(Math.ceil(budget * 1e9))
  const decisions: Study['experiments'] = []
  const runs = new Set<string>()
  let cost = 0n
  const report = (reason: string) => ({
    reason,
    decisions,
    costNano: cost.toString(),
    runs: runs.size
  })
  const measure = async (taskId: string, strategy: string, version: string) => {
    signal?.throwIfAborted()
    if (cost + reserve > limit) throw new Error('Presupuesto de la campaña alcanzado.')
    const trial = await request<Trial>('/benchmarks', { taskId, strategy, version, budget })
    if (!runs.has(trial.runId)) {
      runs.add(trial.runId)
      cost += BigInt(trial.costNano)
    }
    if (!trial.completeUsage || trial.error)
      throw new Error(trial.error || 'Uso incompleto del proveedor.')
  }
  try {
    let state = await request<State>('/evolution')
    if (state.sealed) return report('El test final ya cerró el estudio.')
    const validation = state.cases.filter((c) => c.split === 'validation')
    if (!validation.length) return report('Importa casos independientes de validación.')
    for (const task of state.cases.filter((c) => c.split === 'dev' && !c.verifiedDev)) {
      progress?.('Midiendo desarrollo')
      await measure(task.id, 'static', 'v1')
    }
    if (options.teams && !state.candidate) {
      for (const task of state.cases.filter((c) => c.split === 'dev')) {
        progress?.('Comparando equipos en desarrollo')
        for (const strategy of teamStrategies) await measure(task.id, strategy, 'v1')
      }
    }
    for (let generation = 0; generation < generations; generation++) {
      signal?.throwIfAborted()
      if (
        state.candidate &&
        state.policies.find((p) => p.id === state.candidate)?.proposal?.mode !== mode
      )
        return report('Cierra la candidata pendiente de otro modo de búsqueda.')
      const next = await request<Policy>('/optimizations', { mode })
      if (next.proposal && next.proposal.mode !== mode)
        return report('La candidata pertenece a otra estrategia.')
      for (const [index, task] of validation.entries()) {
        progress?.(
          'Generación ' +
            (generation + 1) +
            ' · validación ' +
            (index + 1) +
            '/' +
            validation.length
        )
        const arms = [
          ['fixed', 'v1'],
          ['static', 'v1'],
          ['adaptive', state.active],
          ['adaptive', next.id]
        ]
        for (let i = 0; i < arms.length; i++) {
          const [strategy, version] = arms[(index + i) % arms.length]
          await measure(task.id, strategy, version)
        }
      }
      signal?.throwIfAborted()
      const decision = await request<Study['experiments'][number]>('/evolution/decide', {
        candidate: next.id
      })
      decisions.push(decision)
      state = await request<State>('/evolution')
    }
    return report('Límite de generaciones alcanzado.')
  } catch (e) {
    return report(signal?.aborted ? 'Campaña detenida.' : (e as Error).message)
  }
}
