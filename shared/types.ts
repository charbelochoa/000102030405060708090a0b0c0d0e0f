export type ProviderId = 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'nvidia' | 'local'
export type RunStatus = 'queued' | 'running' | 'completed' | 'stopped' | 'failed'
export type StopReason =
  | 'target'
  | 'budget'
  | 'iterations'
  | 'plateau'
  | 'user'
  | 'error'
  | 'recovered'
  | 'timeout'
  | 'delivered'
export type Tier = 'low' | 'medium' | 'high' | 'reasoning'
export interface Usage {
  input: number
  output: number
  cached: number
  cacheWrite: number
  reasoning: number | null
}
export interface Model {
  id: string
  name: string
  provider: ProviderId
  tier: Tier
  inputPrice: number
  outputPrice: number
  cachedPrice: number
  cacheWritePrice: number
  vision: boolean
  source: string
  checkedAt: string
}
export interface ProviderConfig {
  id: ProviderId
  enabled: boolean
  hasKey: boolean
  freeTier: boolean
}
export interface Settings {
  router: boolean
  routerModel: string
  optimizer: boolean
  quietThreshold: number
  budget: number
  maxIterations: number
  target: number
  patience: number
  minDelta: number
  allowWrites: boolean
  allowCommands: boolean
  providers: ProviderConfig[]
  models: Model[]
}
export interface Attachment {
  name: string
  type: string
  data: string
}
export interface Iteration {
  index: number
  score: number
  costNano: string
  tokens: number
  latency: number
  verdict: string
  candidate: string
  accepted: boolean
}
export interface Run {
  id: string
  owner: string
  title: string
  prompt: string
  model: string
  reviewer: string
  status: RunStatus
  mode: 'live'
  calls?: {
    id: string
    model: string
    provider: ProviderId
    actualModel?: string
    startedAt: string
    state: 'pending' | 'reported' | 'unknown'
    latencyMs?: number
    tariff: Model
  }[]
  charts?: Record<string, 'bar' | 'line'>
  artifacts?: string[]
  steps?: { role: string; model?: string; detail: string }[]
  error?: string
  createdAt: string
  updatedAt: string
  iterations: Iteration[]
  usage: Usage
  costNano: string
  unknownUsage: boolean
  stopReason?: StopReason
  result: string
  budget: number
  maxIterations: number
  target: number
  session: string
  attachments: Attachment[]
}
export interface AgentMessage {
  id: string
  owner: string
  room: string
  from: string
  to: string
  text: string
  createdAt: string
}
export interface AgentEvent {
  id: string
  owner: string
  runId?: string
  type: string
  text: string
  createdAt: string
  data?: unknown
}
export interface UsageRecord {
  id: string
  owner: string
  runId: string
  model: string
  requestedModel: string
  provider: ProviderId
  usage: Usage
  costNano: string
  tariff: Model
  freeTier: boolean
  latencyMs: number
  createdAt: string
}
export interface Skill {
  id: string
  name: string
  description: string
  enabled: boolean
  content: string
  source?: string
  builtin: boolean
}
export interface User {
  id: string
  email: string
  name: string
  provider: string
}
export interface Snapshot {
  runs: Run[]
  events: AgentEvent[]
  messages: AgentMessage[]
  ledger: UsageRecord[]
  settings: Settings
  skills: Skill[]
  workspace: string
  user: User | null
  auth: { google: boolean; github: boolean; required: boolean }
}
