import type { AgentMessage, RunStatus, StopReason } from './types'

export const lessonPrefix = 'Lección de atención'

export interface PhoneRating {
  resolved: boolean
  score?: number
  note: string
  ratedAt: string
}

export interface PhoneConversation {
  id: string
  owner: string
  room: string
  company: string
  customer: string
  scenario: string
  model: string
  lessons: number
  createdAt: string
  runIds: string[]
  rating?: PhoneRating
  lessonPageId?: string
}

export interface PhoneTurn {
  id: string
  status: RunStatus
  stopReason?: StopReason
  error?: string
}

export interface PhoneConversationView extends PhoneConversation {
  messages: AgentMessage[]
  turns: PhoneTurn[]
  pending: boolean
  usage: { input: number; output: number; calls: number; costNano: string; latencyMs: number }
}

export interface PhoneGroup {
  lessons: number
  conversations: number
  resolved: number
  tokens: number
  costNano: string
}

export function groupByLessons(items: PhoneConversationView[]): PhoneGroup[] {
  const groups = new Map<number, PhoneGroup>()
  for (const c of items.filter((i) => i.rating)) {
    const g = groups.get(c.lessons) || {
      lessons: c.lessons,
      conversations: 0,
      resolved: 0,
      tokens: 0,
      costNano: '0'
    }
    g.conversations += 1
    g.resolved += c.rating!.resolved ? 1 : 0
    g.tokens += c.usage.input + c.usage.output
    g.costNano = (BigInt(g.costNano) + BigInt(c.usage.costNano)).toString()
    groups.set(c.lessons, g)
  }
  return [...groups.values()].sort((a, b) => a.lessons - b.lessons)
}
