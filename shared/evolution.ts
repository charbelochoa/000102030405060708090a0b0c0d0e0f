export interface WorkflowPolicy {
  budgetInclusive: boolean
  normalizeFuel: boolean
  minimumSeats: boolean
  onlyAvailable: true
}
export interface WorkflowVersion {
  id: string
  parent: string | null
  createdAt: string
  policy: WorkflowPolicy
  hash: string
  hypothesis: string
}
export interface BenchmarkRow {
  taskId: string
  category: string
  success: boolean
  critical: boolean
  expected: string[]
  actual: string[]
  latencyMs: number
}
export interface BenchmarkReport {
  id: string
  versionId: string
  split: 'dev' | 'validation' | 'test'
  mode: 'deterministic'
  datasetHash: string
  count: number
  passed: number
  quality: number
  criticalErrors: number
  latencyMs: number
  p50: number
  p95: number
  inputTokens: null
  outputTokens: null
  apiCostUsd: number
  rows: BenchmarkRow[]
}
export interface Experiment {
  id: string
  sourceVersion: string
  candidateVersion: string
  createdAt: string
  hypothesis: string
  changes: string[]
  status: 'accepted' | 'rejected'
  reason: string
  stable: BenchmarkReport
  candidate: BenchmarkReport
  development: BenchmarkReport
  artifact: string
}
export interface EvolutionState {
  stable: string
  versions: WorkflowVersion[]
  experiments: Experiment[]
  reports: BenchmarkReport[]
}
