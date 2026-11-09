import { z } from 'zod'

import { fileTypes } from './file-types'

export const fileSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(Object.values(fileTypes)),
  data: z
    .string()
    .max(6666668)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/)
})
export const planSchema = z
  .object({
    aggregation: z.enum(['sum', 'mean', 'count', 'min', 'max', 'median', 'stddev']),
    subtract: z.string().min(1).max(200).optional(),
    metric: z.string().min(1).max(200).optional(),
    group_by: z.string().min(1).max(200).optional(),
    period: z.literal('month').optional(),
    currency_column: z.string().min(1).max(200).optional(),
    filters: z
      .array(z.object({ column: z.string().min(1).max(200), equals: z.string().max(500) }))
      .max(12)
      .optional()
  })
  .strict()
  .refine((p) => p.aggregation === 'count' || !!p.metric, 'Selecciona una columna numérica.')
  .refine((p) => !p.subtract || p.aggregation !== 'count', 'La deducción requiere una métrica.')
  .refine((p) => !p.period || !!p.group_by, 'Selecciona la columna de fecha.')
export type AnalysisPlan = z.infer<typeof planSchema>
export interface Point {
  label: string
  value: string
  rows: number
}
export interface AnalysisArtifact {
  id: string
  runId: string
  source: string
  sha256: string
  sheet: string | null
  plan: AnalysisPlan
  points: Point[]
  rowsTotal: number
  rowsMatched: number
  currency: string | null
  verified: true
  warnings: string[]
}
export interface Profile {
  tableHash?: string
  source: string
  sha256: string
  sheets: string[]
  sheet: string | null
  rows?: number
  columns?: {
    name: string
    type: string
    nulls: number
    numeric: number
    distinct: number
    invalidDates: number | null
    outliersIQR: number | null
  }[]
  sections?: number
  characters?: number
  duplicates?: number
  warnings: string[]
}
export const teamStrategies = ['team1', 'team2', 'team3'] as const
export type Strategy = 'fixed' | 'static' | 'adaptive' | (typeof teamStrategies)[number]
export interface Procedure {
  team?: string[]
  developmentRuns?: string[]
  key: string
  plan: AnalysisPlan
  evidence: string[]
}
export interface Policy {
  id: string
  procedures: Procedure[]
  createdAt: string
  proposal?: Proposal
}
export type SearchMode = 'adaptive' | 'static'
export interface Proposal {
  mode: SearchMode
  operator: string
  key: string
  question: string
  action: 'add' | 'replace' | 'retire'
  acceptedBefore: number
  rejectedBefore: number
  evidence: string[]
  history: string[]
}
export interface Performance {
  cases: number
  correct: number
  tokens: number
  costNano: string
  calls: number
  latencyMs: number
}
export interface Trial {
  invalidPlan?: string
  team?: string[]
  configuration: string
  plan?: AnalysisPlan
  runId: string
  taskId: string
  strategy: Strategy
  version: string
  success: boolean
  completeUsage: boolean
  tokens: number
  costNano: string
  latencyMs: number
  calls: number
  recalled: boolean
  error?: string
}
export interface Assessment {
  sourceRunId?: string
  tableHash?: string
  id: string
  prompt: string
  sha256: string
  sheet?: string
  split: 'dev' | 'validation' | 'test'
  source: string
  mime: string
  expected: { label: string; value: string }[]
  plan?: AnalysisPlan
  schemaKey: string
}
export interface Study {
  historyVersion?: number
  archives?: Pick<Study, 'cases' | 'trials' | 'experiments' | 'active'>[]
  policies: Policy[]
  active: string
  cases: Assessment[]
  trials: Trial[]
  experiments: {
    id: string
    parent: string
    candidate: string
    accepted: boolean
    reason: string
    pairs: number
    createdAt: string
    proposal?: Proposal
    baseline?: Performance
    measured?: Performance
    round?: number
    reconstructed?: boolean
    regressions?: number
    configuration?: string
    measurements?: { previous: string; next: string }[]
  }[]
  candidate?: string
  sealed?: boolean
}
