import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { z } from 'zod'
import { data, dataDir, event, save } from './store'
import { inventory, searchInventory, type InventoryFilters } from './inventory'
import type {
  BenchmarkReport,
  EvolutionState,
  Experiment,
  WorkflowPolicy,
  WorkflowVersion
} from '../shared/evolution'

export const policySchema = z
  .object({
    budgetInclusive: z.boolean(),
    normalizeFuel: z.boolean(),
    minimumSeats: z.boolean(),
    onlyAvailable: z.literal(true)
  })
  .strict()
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const referencePolicy: WorkflowPolicy = {
  budgetInclusive: true,
  normalizeFuel: true,
  minimumSeats: true,
  onlyAvailable: true
}
const initialPolicy: WorkflowPolicy = {
  budgetInclusive: false,
  normalizeFuel: false,
  minimumSeats: false,
  onlyAvailable: true
}
const createVersion = (
  id: string,
  parent: string | null,
  policy: WorkflowPolicy,
  hypothesis: string
): WorkflowVersion => ({
  id,
  parent,
  policy: policySchema.parse(policy),
  hypothesis,
  hash: hash(policy),
  createdAt: new Date().toISOString()
})

export function evolution(): EvolutionState {
  if (!data.evolution) {
    data.evolution = {
      stable: 'v1',
      versions: [
        createVersion(
          'v1',
          null,
          initialPolicy,
          'Baseline de filtros exactos, presupuesto exclusivo y asientos exactos.'
        )
      ],
      experiments: [],
      reports: []
    }
    save()
  }
  return data.evolution
}

export const stablePolicy = () => {
  const state = evolution()
  return structuredClone(state.versions.find((v) => v.id === state.stable)!.policy)
}

function cases(split: BenchmarkReport['split']) {
  const offset = { dev: 0, validation: 20, test: 35 }[split]
  const count = split === 'dev' ? 20 : 15
  const prices = [350000, 279000, 249000, 420000, 480000, 319000, 390000]
  return Array.from({ length: count }, (_, i) => {
    const n = offset + i
    const category = ['boundary', 'fuel', 'seats', 'combined', 'availability'][n % 5]
    const filters: InventoryFilters =
      category === 'boundary'
        ? { maxPrice: prices[n % prices.length] }
        : category === 'fuel'
          ? { fuel: ['Gasolina', 'HÍBRIDO', 'ELÉCTRICO'][n % 3] }
          : category === 'seats'
            ? { seats: [2, 5, 7][n % 3] }
            : category === 'combined'
              ? { maxPrice: prices[n % prices.length], type: 'suv', seats: 5 }
              : { maxPrice: 900000, type: n % 2 ? 'sedan' : 'suv' }
    return {
      id: `${split}-${String(i + 1).padStart(3, '0')}`,
      category,
      filters,
      expected: searchInventory(filters, referencePolicy)
        .map((v) => v.id)
        .sort()
    }
  })
}

export function benchmarkPolicy(
  version: WorkflowVersion,
  split: BenchmarkReport['split']
): BenchmarkReport {
  const policy = policySchema.parse(version.policy)
  if (hash(policy) !== version.hash)
    throw new Error('La configuración no coincide con su hash inmutable.')
  const dataset = cases(split)
  const start = performance.now()
  const rows = dataset.map((task) => {
    const at = performance.now()
    const actual = searchInventory(task.filters, policy)
      .map((v) => v.id)
      .sort()
    return {
      taskId: task.id,
      category: task.category,
      success: JSON.stringify(actual) === JSON.stringify(task.expected),
      critical: actual.some((id) => !inventory.find((v) => v.id === id)?.available),
      expected: task.expected,
      actual,
      latencyMs: performance.now() - at
    }
  })
  const durations = rows.map((r) => r.latencyMs).sort((a, b) => a - b)
  const passed = rows.filter((r) => r.success).length
  return {
    id: randomUUID(),
    versionId: version.id,
    split,
    mode: 'deterministic',
    datasetHash: hash(dataset),
    count: rows.length,
    passed,
    quality: (passed / rows.length) * 100,
    criticalErrors: rows.filter((r) => r.critical).length,
    latencyMs: performance.now() - start,
    p50: durations[Math.floor(durations.length * 0.5)],
    p95: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))],
    inputTokens: null,
    outputTokens: null,
    apiCostUsd: 0,
    rows
  }
}

export function gate(stable: BenchmarkReport, candidate: BenchmarkReport) {
  if (stable.split !== candidate.split || stable.datasetHash !== candidate.datasetHash)
    return { accepted: false, reason: 'Dataset o partición no comparables.' }
  if (candidate.criticalErrors > 0)
    return { accepted: false, reason: 'El candidato introduce un error crítico.' }
  if (candidate.quality < stable.quality)
    return { accepted: false, reason: 'Regresión de calidad.' }
  if (candidate.quality <= stable.quality)
    return { accepted: false, reason: 'No hay una mejora medible. La versión estable se conserva.' }
  return {
    accepted: true,
    reason: 'Mejora de exactitud sobre validación independiente, sin errores críticos.'
  }
}

export function runBenchmark(owner: string, versionId: string, split: BenchmarkReport['split']) {
  const state = evolution()
  const version = state.versions.find((v) => v.id === versionId)
  if (!version) throw new Error('Versión no encontrada.')
  const report = benchmarkPolicy(version, split)
  state.reports.push(report)
  const folder = join(dataDir, 'experiments', 'reports')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${report.id}.json`), JSON.stringify(report, null, 2))
  event(
    owner,
    'benchmark',
    `Benchmark local ${versionId} / ${split}: ${report.passed}/${report.count} casos correctos. No se usaron LLMs.`
  )
  return report
}

export function optimize(owner: string) {
  const state = evolution()
  const stable = state.versions.find((v) => v.id === state.stable)!
  const development = benchmarkPolicy(stable, 'dev')
  const failures = new Set(development.rows.filter((r) => !r.success).map((r) => r.category))
  const policy = structuredClone(stable.policy)
  const changes: string[] = []
  if (failures.has('boundary') || failures.has('combined')) {
    policy.budgetInclusive = true
    if (!stable.policy.budgetInclusive) changes.push('budgetInclusive: false → true')
  }
  if (failures.has('fuel')) {
    policy.normalizeFuel = true
    if (!stable.policy.normalizeFuel) changes.push('normalizeFuel: false → true')
  }
  if (failures.has('seats') || failures.has('combined')) {
    policy.minimumSeats = true
    if (!stable.policy.minimumSeats) changes.push('minimumSeats: false → true')
  }
  const hypothesis = changes.length
    ? 'Los errores de desarrollo sugieren límites inclusivos, normalización de combustible y plazas mínimas. Evaluar estos cambios con casos independientes.'
    : 'La memoria y los errores de desarrollo no justifican nuevos cambios dentro del espacio de políticas permitido.'
  const candidate = createVersion(`v${state.versions.length + 1}`, stable.id, policy, hypothesis)
  const id = randomUUID()
  const folder = join(dataDir, 'experiments', id)
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'candidate.json'), JSON.stringify(candidate, null, 2))
  const stableReport = benchmarkPolicy(stable, 'validation')
  const candidateReport = benchmarkPolicy(candidate, 'validation')
  const decision = gate(stableReport, candidateReport)
  const experiment: Experiment = {
    id,
    sourceVersion: stable.id,
    candidateVersion: candidate.id,
    createdAt: new Date().toISOString(),
    hypothesis,
    changes,
    status: decision.accepted ? 'accepted' : 'rejected',
    reason: decision.reason,
    stable: stableReport,
    candidate: candidateReport,
    development,
    artifact: folder
  }
  state.versions.push(candidate)
  state.experiments.unshift(experiment)
  if (decision.accepted) state.stable = candidate.id
  writeFileSync(join(folder, 'experiment.json'), JSON.stringify(experiment, null, 2))
  writeFileSync(
    join(folder, 'REPORT.md'),
    `# AERIS — experimento ${id}\n\nModo: evaluación determinista de políticas de inventario sintético. Sin llamadas a modelos.\n\n${hypothesis}\n\n- Origen: ${stable.id}\n- Candidato: ${candidate.id}\n- Validación inicial: ${stableReport.passed}/${stableReport.count}\n- Validación candidata: ${candidateReport.passed}/${candidateReport.count}\n- Decisión: ${experiment.status}\n- Motivo: ${experiment.reason}\n- Coste API: USD 0\n- Tokens de modelos: no aplican\n- Test sellado: no ejecutado durante optimización\n\n## Cambios\n\n${changes.map((c) => `- ${c}`).join('\n') || 'Sin cambios.'}\n`
  )
  event(
    owner,
    'evolution',
    `${stable.id} → ${candidate.id}: ${experiment.status === 'accepted' ? 'aceptada' : 'rechazada'}. ${decision.reason}`
  )
  return experiment
}

export function rollback(owner: string, id: string) {
  const state = evolution()
  const accepted =
    id === 'v1' ||
    state.experiments.some((e) => e.candidateVersion === id && e.status === 'accepted')
  if (!accepted || !state.versions.some((v) => v.id === id))
    throw new Error('Solo puedes restaurar una versión previamente aceptada.')
  const before = state.stable
  state.stable = id
  event(owner, 'rollback', `Versión estable restaurada: ${before} → ${id}.`)
  return state
}
