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

export interface PerformancePoint {
  cycle: number
  score: number
  tokens?: number
  model?: string
  tier?: string
  leaderDecision?: string
  rmse?: number
  mape?: number
  f1?: number
}

export interface RsiStageSummaryItem {
  id: string
  name: string
  whatWeDo: string
  count: number
  detail: string
}

export function renderAsciiRsiLoopDiagram(stages?: RsiStageSummaryItem[]): string {
  const countOf = (id: string) => {
    const found = stages?.find((s) => s.id === id)
    return found ? `${String(found.count).padStart(2, '0')}x` : 'OK '
  }
  const lines = [
    '+==============================================================================================+',
    '|                       CIRCUITO CERRADO DEL LOOP RSI (7 ETAPAS EN VIVO)                       |',
    '+==============================================================================================+',
    '|                                                                                              |',
    `|  +--------------------+     +--------------------+     +--------------------+                |`,
    `|  | [01] CONTEXTO RSI  |====>| [02] 1a PASADA     |====>| [03] ROUTER COGNIT.|                |`,
    `|  | Errores y Reglas   |     | Skills + Caveman   |     | low -> med -> high |                |`,
    `|  | Consultas: (${countOf('01')})   |     | Ejecuciones: (${countOf('02')}) |     | Escalados:   (${countOf('03')}) |                |`,
    `|  +--------------------+     +--------------------+     +--------------------+                |`,
    '|            ^                                                      |                          |',
    '|            |                                                      v                          |',
    '|            | (Inyecta regla correctiva t+1)            +--------------------+                |',
    '|            | (Reduce RMSE y MAPE en sig. ciclo)        | [04] COORDINACION  |                |',
    '|            |                                           | Orquestador / Team |                |',
    `|            |                                           | Misiones:    (${countOf('04')}) |                |`,
    '|            |                                           +--------------------+                |',
    '|            |                                                      |                          |',
    '|            |                                                      v                          |',
    `|  +--------------------+     +--------------------+     +--------------------+                |`,
    `|  | [07] MEMORIA RSI   |<====| [06] EVAL + LIDER  |<====| [05] HERRAMIENTAS  |                |`,
    `|  | Bitacora de Ciclos |     | RMSE / MAPE / F1   |     | query_kavak_db SQL |                |`,
    `|  | Lecciones: (${countOf('07')})   |     | Evaluadas:   (${countOf('06')}) |     | Llamadas BD: (${countOf('05')}) |                |`,
    `|  +--------------------+     +--------------------+     +--------------------+                |`,
    '|                                                                                              |',
    '+==============================================================================================+'
  ]
  if (stages?.length) {
    lines.push('| DETALLE OPERATIVO POR ETAPA DEL LOOP:                                                        |')
    for (const st of stages) {
      const row = `[${st.id}] ${st.name.padEnd(23, ' ')} (${String(st.count).padStart(2, ' ')}x) | ${st.whatWeDo}`
      lines.push(`|   ${row.slice(0, 90).padEnd(90, ' ')} |`)
    }
    lines.push('+==============================================================================================+')
  }
  return lines.join('\n')
}

export interface PerformanceTrend {
  count: number
  slope: number
  intercept: number
  rSquared: number
  isLinearImprovement: boolean
  firstScore: number
  lastScore: number
  totalDelta: number
  meanTokens: number
  summary: string
}

export function computePerformanceTrend(points: PerformancePoint[]): PerformanceTrend {
  const n = points.length
  if (!n) {
    return {
      count: 0,
      slope: 0,
      intercept: 0,
      rSquared: 0,
      isLinearImprovement: false,
      firstScore: 0,
      lastScore: 0,
      totalDelta: 0,
      meanTokens: 0,
      summary: 'Sin ciclos evaluados por revisor.'
    }
  }
  const firstScore = points[0].score
  const lastScore = points[n - 1].score
  const totalDelta = lastScore - firstScore
  const meanTokens = Math.round(
    points.reduce((acc, p) => acc + (p.tokens || 0), 0) / Math.max(1, n)
  )
  if (n === 1) {
    return {
      count: 1,
      slope: 0,
      intercept: firstScore,
      rSquared: 0,
      isLinearImprovement: false,
      firstScore,
      lastScore,
      totalDelta: 0,
      meanTokens,
      summary: `1 ciclo evaluado (${firstScore.toFixed(1)}/100). Se requieren al menos 2 ciclos para medir pendiente y linealidad.`
    }
  }
  const xs = points.map((_, i) => i + 1)
  const ys = points.map((p) => p.score)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const slope = denX > 0 ? num / denX : 0
  const intercept = meanY - slope * meanX
  const rSquared = denX > 0 && denY > 0 ? Math.max(0, Math.min(1, (num * num) / (denX * denY))) : 0
  const isLinearImprovement = slope > 0.25 && rSquared >= 0.6
  const sign = slope >= 0 ? '+' : ''
  const linearityLabel =
    slope > 0.25
      ? rSquared >= 0.6
        ? 'mejora lineal consistente'
        : 'mejora positiva con varianza entre ciclos'
      : slope < -0.25
        ? 'descenso entre ciclos'
        : 'estancamiento (meseta)'
  return {
    count: n,
    slope,
    intercept,
    rSquared,
    isLinearImprovement,
    firstScore,
    lastScore,
    totalDelta,
    meanTokens,
    summary: `Tendencia (evaluación de modelo en ${n} ciclos): ${linearityLabel} · pendiente ${sign}${slope.toFixed(2)} pts/ciclo · R^2=${rSquared.toFixed(2)} · delta ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(1)} pts.`
  }
}

export function renderAsciiProgressBar(
  completed: number,
  total: number,
  width = 24,
  label = 'Progreso RSI'
): string {
  const safeTotal = Math.max(1, total)
  const clamped = Math.max(0, Math.min(safeTotal, completed))
  const ratio = clamped / safeTotal
  const filled = Math.round(ratio * width)
  const bar = '#'.repeat(filled) + '-'.repeat(Math.max(0, width - filled))
  const pct = Math.round(ratio * 100)
  return `${label}: [${bar}] ${String(pct).padStart(3, ' ')}% (${clamped}/${safeTotal})`
}

export function renderAsciiPerformanceChart(
  points: PerformancePoint[],
  stageCompleted = 0,
  stageTotal = 7
): string {
  const progress = renderAsciiProgressBar(stageCompleted, stageTotal, 28, 'Pipeline RSI')
  if (!points.length) {
    return `${progress}\nSin ciclos evaluados todavía para graficar desempeño.`
  }
  const trend = computePerformanceTrend(points)
  const rows = 10
  const cols = Math.min(points.length, 10)
  const slice = points.slice(-cols)
  const colWidth = 8
  const gridWidth = cols * colWidth
  const grid: string[][] = Array.from({ length: rows }, () => Array(gridWidth).fill(' '))
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < gridWidth; x++) {
      if (r % 2 === 0 && x % 2 === 0) grid[r][x] = ':'
    }
  }
  for (let i = 0; i < cols; i++) {
    const center = i * colWidth + 3
    const actualY = Math.max(
      0,
      Math.min(rows - 1, rows - 1 - Math.round((slice[i].score / 100) * (rows - 1)))
    )
    for (let r = rows - 1; r > actualY; r--) {
      grid[r][center - 1] = '|'
      grid[r][center] = '#'
      grid[r][center + 1] = '|'
    }
    const regScore = Math.max(
      0,
      Math.min(100, trend.intercept + trend.slope * (points.length - cols + i + 1))
    )
    const regY = Math.max(
      0,
      Math.min(rows - 1, rows - 1 - Math.round((regScore / 100) * (rows - 1)))
    )
    if (slice.length > 1) {
      grid[regY][center - 1] = '('
      grid[regY][center] = '.'
      grid[regY][center + 1] = ')'
    }
    const rmseVal =
      slice[i].rmse !== undefined ? slice[i].rmse! * 100 : Math.max(0, 100 - slice[i].score)
    const errY = Math.max(
      0,
      Math.min(rows - 1, rows - 1 - Math.round((Math.min(100, rmseVal) / 100) * (rows - 1)))
    )
    if (errY !== actualY) {
      grid[errY][center - 1] = '['
      grid[errY][center] = 'x'
      grid[errY][center + 1] = ']'
    }
    grid[actualY][center - 1] = '['
    grid[actualY][center] = '*'
    grid[actualY][center + 1] = ']'
  }
  const firstRmse =
    slice[0].rmse !== undefined ? slice[0].rmse! : Number(((100 - slice[0].score) / 100).toFixed(3))
  const lastRmse =
    slice[cols - 1].rmse !== undefined
      ? slice[cols - 1].rmse!
      : Number(((100 - slice[cols - 1].score) / 100).toFixed(3))
  const lines: string[] = [
    '+==============================================================================================+',
    `| ${progress.padEnd(92, ' ')} |`,
    `| ${trend.summary.slice(0, 92).padEnd(92, ' ')} |`,
    `| Reduccion de Error Estadistico (RMSE): ${firstRmse.toFixed(4)} ---> ${lastRmse.toFixed(4)}  |  R^2=${trend.rSquared.toFixed(3)}  |  Pendiente=${trend.slope >= 0 ? '+' : ''}${trend.slope.toFixed(2)} pts/ciclo`.padEnd(
      95,
      ' '
    ) + '|',
    '+==============================================================================================+',
    ''
  ]
  for (let r = 0; r < rows; r++) {
    const tick = Math.round(100 - (r / (rows - 1)) * 100)
    lines.push(`  ${String(tick).padStart(3, ' ')}% | ${grid[r].join('')} |`)
  }
  lines.push(`       +${'-'.repeat(gridWidth)}-+`)
  lines.push(
    `        ${slice.map((p) => `  C${String(p.cycle).padEnd(colWidth - 3, ' ')}`).join('')}`
  )
  lines.push(
    '  Leyenda: [*] Score real del ciclo   |#| Barra de desempeno   (.) Recta regresion lineal   [x] Error RMSE%'
  )
  lines.push('')
  lines.push(
    '+-------+---------+--------------+----------+----------+--------+----------------------+----------------+'
  )
  lines.push(
    '| CICLO |  SCORE  | PROGRESO     |   RMSE   |   MAPE   |   F1   | MODELO (TIER)        | DECISION LIDER |'
  )
  lines.push(
    '+-------+---------+--------------+----------+----------+--------+----------------------+----------------+'
  )
  for (const p of slice) {
    const miniFilled = Math.max(0, Math.min(10, Math.round(p.score / 10)))
    const miniBar = `[${'#'.repeat(miniFilled)}${'-'.repeat(10 - miniFilled)}]`
    const rmseStr = (p.rmse !== undefined ? p.rmse : (100 - p.score) / 100).toFixed(4)
    const mapeStr = `${(p.mape !== undefined ? p.mape : 100 - p.score).toFixed(1)}%`
    const f1Str = (p.f1 !== undefined ? p.f1 : p.score / 100).toFixed(2)
    const modelStr = `${p.model || 'llm'}${p.tier ? ` (${p.tier})` : ''}`.slice(0, 20)
    const decStr = (p.leaderDecision || 'accept').slice(0, 14)
    lines.push(
      `| C${String(p.cycle).padEnd(4, ' ')} | ${p.score.toFixed(1).padStart(7, ' ')} | ${miniBar} | ${rmseStr.padStart(8, ' ')} | ${mapeStr.padStart(8, ' ')} | ${f1Str.padStart(6, ' ')} | ${modelStr.padEnd(20, ' ')} | ${decStr.padEnd(14, ' ')} |`
    )
  }
  lines.push(
    '+-------+---------+--------------+----------+----------+--------+----------------------+----------------+'
  )
  return lines.join('\n')
}
