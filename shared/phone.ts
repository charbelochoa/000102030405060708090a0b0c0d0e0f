import type {
  AgentEvent,
  AgentMessage,
  Coordination,
  Iteration,
  RunStatus,
  StopReason,
  TeamTask
} from './types'

export const lessonPrefix = 'Lección de atención'

export interface RsiStageSpec {
  id: '01' | '02' | '03' | '04' | '05' | '06' | '07'
  code: string
  title: string
  short: string
}

export const rsiStages: RsiStageSpec[] = [
  { id: '01', code: 'CONTEXTO', title: 'Solicitud y contexto', short: 'Contexto' },
  { id: '02', code: 'PASADA', title: 'Primera pasada', short: '1a pasada' },
  { id: '03', code: 'ROUTER', title: 'Router de modelos', short: 'Router' },
  { id: '04', code: 'ORQUESTADOR', title: 'Orquestador y plan', short: 'Orquestador' },
  { id: '05', code: 'EQUIPO', title: 'Equipo de agentes', short: 'Equipo' },
  { id: '06', code: 'SUPERVISOR', title: 'Verificación y supervisor', short: 'Supervisor' },
  { id: '07', code: 'RSI', title: 'Aprendizaje validado', short: 'Aprendizaje RSI' }
]

export function eventRsiStage(type: string): RsiStageSpec {
  if (type === 'workflow.team')
    return { ...rsiStages[3], code: 'TABLERO', title: 'Tablero de tareas', short: 'Tablero' }
  if (type === 'team.task') return rsiStages[4]
  if (['phone.started', 'started', 'context.retrieved', 'rsi.context'].includes(type))
    return rsiStages[0]
  if (['rsi.first_pass', 'skill', 'workflow.ingest'].includes(type)) return rsiStages[1]
  if (['routing', 'routed'].includes(type)) return rsiStages[2]
  if (['workflow.plan', 'workflow.delegate', 'workflow.memory'].includes(type)) return rsiStages[3]
  if (
    [
      'message',
      'workflow.handoff',
      'workflow.execute',
      'thinking',
      'tool',
      'tool.result',
      'workflow.tool'
    ].includes(type)
  )
    return rsiStages[4]
  if (['workflow.review', 'reviewing', 'iteration', 'usage', 'workflow.verify'].includes(type))
    return rsiStages[5]
  return rsiStages[6]
}

export interface PhoneRating {
  resolved: boolean
  score?: number
  note: string
  ratedAt: string
}

export interface PhoneConversation {
  coordination?: Coordination
  id: string
  owner: string
  room: string
  company: string
  customer: string
  scenario: string
  model: string
  reviewer?: string
  maxIterations?: number
  lessons: number
  createdAt: string
  runIds: string[]
  rating?: PhoneRating
  lessonPageId?: string
}

export interface PhoneTurn {
  tasks?: TeamTask[]
  id: string
  status: RunStatus
  model?: string
  reviewer?: string
  stopReason?: StopReason
  error?: string
  iterations?: Iteration[]
  steps?: { role: string; model?: string; detail: string }[]
}

export interface PhoneConversationView extends PhoneConversation {
  messages: AgentMessage[]
  events?: AgentEvent[]
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

export interface RsiTraceLine {
  id: string
  stage: RsiStageSpec['id']
  stageCode: string
  kind: 'stage' | 'agent-msg' | 'tool' | 'review' | 'error' | 'result'
  prefix: string
  text: string
  detail?: string
  createdAt: string
}

export function buildRsiTrace(
  events: AgentEvent[],
  messages: AgentMessage[],
  options?: {
    room?: string
    runIds?: string[]
    customer?: string
    company?: string
    coordination?: Coordination
  }
): RsiTraceLine[] {
  const runSet = options?.runIds?.length ? new Set(options.runIds) : null
  const room = options?.room
  const relevantEvents = events.filter((e) => {
    if (e.type === 'message') return false
    if (runSet && e.runId && runSet.has(e.runId)) return true
    if (room && e.data && typeof e.data === 'object' && 'room' in e.data) {
      return (e.data as { room?: string }).room === room
    }
    return !runSet && !room
  })
  const relevantMessages = messages.filter((m) => {
    if (room && m.room !== room) return false
    if (options?.customer && options?.company) {
      const external =
        (m.from === options.customer && m.to === options.company) ||
        (m.from === options.company && m.to === options.customer)
      return !external
    }
    return true
  })

  const raw: { time: number; line: RsiTraceLine }[] = []

  for (const e of relevantEvents) {
    const stage = eventRsiStage(e.type)
    const spec =
      options?.coordination === 'autonomous' && stage.id === '06'
        ? { ...stage, title: 'Revisión entre pares', code: 'REVISION' }
        : stage
    const isError = e.type === 'error' || e.type === 'phone.failed'
    const isTool = e.type === 'tool' || e.type === 'tool.result' || e.type === 'workflow.tool'
    const isReview =
      e.type === 'reviewing' || e.type === 'iteration' || e.type === 'workflow.review'
    let detail: string | undefined
    if (e.type === 'tool.result' && e.data && typeof e.data === 'object') {
      const payload = e.data as { arguments?: unknown; result?: string }
      const args = payload.arguments ? JSON.stringify(payload.arguments).slice(0, 140) : ''
      const res = payload.result ? String(payload.result).slice(0, 180) : ''
      detail = [args ? `args: ${args}` : '', res ? `out: ${res}` : ''].filter(Boolean).join(' -> ')
    }
    raw.push({
      time: new Date(e.createdAt).getTime(),
      line: {
        id: `ev-${e.id}`,
        stage: spec.id,
        stageCode: spec.code,
        kind: isError ? 'error' : isTool ? 'tool' : isReview ? 'review' : 'stage',
        prefix: `[RSI ${spec.id} · ${spec.code}]`,
        text: e.text,
        detail,
        createdAt: e.createdAt
      }
    })
  }

  for (const m of relevantMessages) {
    const isSupervisor =
      m.from.includes('supervisor') ||
      m.to.includes('supervisor') ||
      m.text.startsWith('Iteración ') ||
      m.text.startsWith('Candidato ')
    const isRsi = m.from === 'supervisor-rsi' || m.to === 'cerebro-contexto'
    const spec = isRsi ? rsiStages[6] : isSupervisor ? rsiStages[5] : rsiStages[4]
    raw.push({
      time: new Date(m.createdAt).getTime(),
      line: {
        id: `msg-${m.id}`,
        stage: spec.id,
        stageCode: spec.code,
        kind: isSupervisor ? 'review' : 'agent-msg',
        prefix: `[${m.from} -> ${m.to}]`,
        text: m.text,
        createdAt: m.createdAt
      }
    })
  }

  return raw.sort((a, b) => a.time - b.time).map((x) => x.line)
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
