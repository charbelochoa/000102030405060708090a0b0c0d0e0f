export const requiredContextSpaces = [
  'Espacio de errores y mejoras RSI',
  'Lecciones de atención',
  'Reglas de arquitectura y orquestación'
] as const

export type LeaderDecision = 'keep_small' | 'escalate_model' | 'spawn_subagent' | 'accept'

export interface SubagentAssignment {
  role: string
  tier: 'low' | 'medium' | 'high' | 'reasoning'
  model?: string
  iterations: number
  reasoning: string
  output?: string
}

export interface ContextCycleRecord {
  id: string
  owner: string
  runId: string
  cycle: number
  coordination: 'orchestrated' | 'autonomous'
  agent: string
  model: string
  tier: 'low' | 'medium' | 'high' | 'reasoning'
  reviewerModel: string
  score: number
  accepted: boolean
  selfCheck: string
  mistake: string
  improvement: string
  leaderDecision: LeaderDecision
  nextModel?: string
  subagent?: SubagentAssignment
  spacesConsulted: string[]
  tokens: number
  costNano: string
  createdAt: string
}

export interface ContextPage {
  id: string
  owner: string
  title: string
  content: string
  tags: string[]
  links: string[]
  updatedAt: string
  enabled: boolean
}
export interface ContextHit {
  pageId: string
  title: string
  excerpt: string
  relevance: number
  estimatedTokens: number
}
export interface ContextRetrieval {
  hits: ContextHit[]
  estimatedTokens: number
  maxTokens: number
  method: 'lexical-datalog'
  text: string
  spacesConsulted?: string[]
}
export const wikiLinks = (content: string) => [
  ...new Set(
    Array.from(content.matchAll(/\[\[([^\]\n]{1,160})\]\]/g), (m) => m[1].trim()).filter(Boolean)
  )
]
export const pageTags = (content: string) => [
  ...new Set(
    Array.from(content.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu), (m) => m[1].toLowerCase())
  )
]
