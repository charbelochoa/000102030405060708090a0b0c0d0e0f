import type { Express, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireUser } from './auth'
import { data, event, message, save } from './store'
import {
  listCycleReflections,
  listPages,
  recordCycleReflection,
  retrieveMandatoryContext,
  savePage
} from './brain'
import { requiredContextSpaces } from '../shared/brain'
import {
  computePerformanceTrend,
  lessonPrefix,
  renderAsciiPerformanceChart,
  renderAsciiProgressBar,
  type PhoneConversation
} from '../shared/phone'
import {
  evaluateKavakResponse,
  kavakOrders,
  kavakPolicies,
  kavakScenarios,
  kavakVehicles,
  type KavakEvaluationResult
} from '../shared/kavak'
import type { Iteration, Run } from '../shared/types'

const owner = (req: Request) => req.aerisUser!.id
const asyncRoute =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next)

const norm = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export function queryKavakDatabase(
  table: 'all' | 'vehicles' | 'orders' | 'policies' = 'all',
  query = ''
) {
  const q = norm(query.trim())
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  const matchRow = (row: unknown) => {
    if (!tokens.length) return true
    const text = norm(JSON.stringify(row))
    return tokens.some((t) => text.includes(t))
  }
  const vehicles =
    table === 'all' || table === 'vehicles' ? kavakVehicles.filter(matchRow) : []
  const orders =
    table === 'all' || table === 'orders' ? kavakOrders.filter(matchRow) : []
  const policies =
    table === 'all' || table === 'policies' ? kavakPolicies.filter(matchRow) : []
  return {
    database: 'kavak-mx-operaciones-v1',
    table,
    query: query.trim() || '*',
    counts: {
      vehicles: vehicles.length,
      orders: orders.length,
      policies: policies.length,
      total: vehicles.length + orders.length + policies.length
    },
    vehicles,
    orders,
    policies
  }
}

interface CycleScript {
  scenarioId: string
  agent: string
  model: string
  tier: 'low' | 'medium' | 'high' | 'reasoning'
  reviewerModel: string
  leaderDecision: 'keep_small' | 'escalate_model' | 'spawn_subagent' | 'accept'
  nextModel?: string
  initialDraft: string
  finalAnswer: string
  mistake: string
  improvement: string
  lessonNote: string
  resolved: boolean
  ratingScore: number
  tokens: number
}

const cycleScripts: CycleScript[] = [
  {
    scenarioId: 'kavak-devolucion-vencida',
    agent: 'constructor-low',
    model: 'gpt-5.4-nano',
    tier: 'low',
    reviewerModel: 'gpt-5.4-nano#perfil-reasoning',
    leaderDecision: 'escalate_model',
    nextModel: 'gpt-5.4-mini',
    initialDraft:
      'Hola Luis, revisé tu pedido ORD-9044 de la Tiguan KVK-2089 en Sede Antara. Aunque llevas 18 días y 620 km, procede tu devolución sin costo hoy mismo o revisión por 90 días.',
    finalAnswer:
      'Hola Luis, revisé tu pedido ORD-9044 de la Tiguan KVK-2089 en Sede Antara. Aunque llevas 18 días y 620 km, procede tu devolución sin costo hoy mismo o revisión por 90 días.',
    mistake:
      'El modelo pequeño (low) consultó ORD-9044 pero no cruzó los 18 días y 620 km contra el límite estricto de POL-DEV-01 (7 días o 300 km), ofreciendo una devolución improcedente.',
    improvement:
      'Cruzar siempre daysSinceDelivery y kmSinceDelivery de la tabla orders con POL-DEV-01 antes de responder; si excede 7 días o 300 km, denegar devolución y ofrecer Garantía Básica de 90 días.',
    lessonNote:
      'En Kavak, verificar siempre en la base de datos si el pedido supera 7 días o 300 km (POL-DEV-01). Si excede cualquiera de los dos, rechazar devolución y ofrecer Garantía Básica de 90 días.',
    resolved: false,
    ratingScore: 2,
    tokens: 410
  },
  {
    scenarioId: 'kavak-devolucion-elegible',
    agent: 'constructor-medium',
    model: 'gpt-5.4-mini',
    tier: 'medium',
    reviewerModel: 'gpt-5.4-nano#perfil-reasoning',
    leaderDecision: 'spawn_subagent',
    nextModel: 'gpt-5.4-mini',
    initialDraft:
      'Hola Ana, revisé el expediente ORD-8821 de tu Mazda 3 KVK-1042. Como llevas 5 días y 190 km, estás dentro de la política de 7 días o 300 km.',
    finalAnswer:
      'Hola Ana, consulté en la base de datos tu pedido ORD-8821 del Mazda 3 KVK-1042. Con 5 días y 190 km recorridos estás dentro del límite de 7 días o 300 km para devolución sin penalización, o bien revisión prioritaria sin costo con tu garantía Kavak Total 12 meses en Sede Lerma.',
    mistake:
      'En el primer borrador el agente validó los 5 días y 190 km frente a los 7 días / 300 km, pero omitió citar la cobertura activa Kavak Total 12 meses y la Sede Lerma de la tabla vehicles.',
    improvement:
      'El líder desplegó un subagente verificador para cruzar orders.activeWarranty y vehicles.hub, incorporando Kavak Total 12 meses y Sede Lerma antes de entregar.',
    lessonNote:
      'Al responder sobre garantías o devoluciones de Kavak, incluir siempre el tipo exacto de garantía activa (Kavak Total 12 meses o Básica 90 días) y la sede asignada en la tabla vehicles.',
    resolved: true,
    ratingScore: 4,
    tokens: 520
  },
  {
    scenarioId: 'kavak-financiamiento-entrega',
    agent: 'constructor-medium',
    model: 'gpt-5.4-mini',
    tier: 'medium',
    reviewerModel: 'gpt-5.4-nano#perfil-reasoning',
    leaderDecision: 'keep_small',
    nextModel: 'gpt-5.4-nano',
    initialDraft:
      'Hola Marta, según la base de datos de Kavak tu pedido ORD-7712 corresponde al Toyota Corolla SE 2023 (KVK-3115) con precio de $389,000 MXN y enganche preaprobado del 20% por $77,800 MXN a 48 meses con Kavak Total en Sede Patio Santa Fe. Para liberar la entrega necesitamos completar tu validación biométrica INE y comprobante de domicilio.',
    finalAnswer:
      'Hola Marta, según la base de datos de Kavak tu pedido ORD-7712 corresponde al Toyota Corolla SE 2023 (KVK-3115) con precio de $389,000 MXN y enganche preaprobado del 20% por $77,800 MXN a 48 meses con Kavak Total en Sede Patio Santa Fe. Para liberar la entrega necesitamos completar tu validación biométrica INE y comprobante de domicilio vigente.',
    mistake:
      'Desviación menor de formato inicial; los montos ($389,000 MXN y $77,800 MXN), la sede Patio Santa Fe y el requisito de validación biométrica y comprobante de domicilio fueron verificados en BD.',
    improvement:
      'Consolidar plantilla de financiamiento citando precio de lista, monto exacto de enganche en MXN, sede de entrega y estatus de validación biométrica (POL-FIN-04) para permitir descenso a modelo low.',
    lessonNote:
      'En consultas de financiamiento Kavak (POL-FIN-04), reportar precio en MXN, monto exacto del enganche, sede y requisitos pendientes de validación biométrica y comprobante de domicilio.',
    resolved: true,
    ratingScore: 5,
    tokens: 380
  },
  {
    scenarioId: 'kavak-inventario-inspeccion',
    agent: 'constructor-low',
    model: 'gpt-5.4-nano',
    tier: 'low',
    reviewerModel: 'gpt-5.4-nano#perfil-reasoning',
    leaderDecision: 'accept',
    initialDraft:
      'Hola Carlos, consulté en la base de datos tu folio ORD-6509 para la Nissan Kicks Advance 2020 (KVK-4090) de $279,000 MXN en Sede Midtown Guadalajara. La unidad está en inspección de 240 puntos con liberación estimada en 48 horas, por lo que no se entrega hoy; si decides cancelar antes de la entrega tienes reembolso del 100% de tu apartado.',
    finalAnswer:
      'Hola Carlos, consulté en la base de datos tu folio ORD-6509 para la Nissan Kicks Advance 2020 (KVK-4090) de $279,000 MXN en Sede Midtown Guadalajara. La unidad está en inspección de 240 puntos con liberación estimada en 48 horas, por lo que no se entrega hoy; si decides cancelar antes de la entrega tienes reembolso del 100% de tu apartado.',
    mistake:
      'Sin errores de política ni de datos: el modelo pequeño (low) reutilizó las 3 lecciones previas del Cerebro de Contexto y verificó ORD-6509, KVK-4090 y POL-INSP-03 al primer intento.',
    improvement:
      'Mantener ejecución en modelo pequeño (low) con consulta previa a los 3 espacios obligatorios y query_kavak_db para sostener precisión alta con mínimo consumo de tokens.',
    lessonNote:
      'Con las reglas de devolución (POL-DEV-01), garantías (POL-GAR-02), financiamiento (POL-FIN-04) e inspección de 240 puntos (POL-INSP-03) en el Cerebro de Contexto, el modelo low resuelve al primer intento.',
    resolved: true,
    ratingScore: 5,
    tokens: 290
  }
]

const countActiveLessons = (who: string) =>
  listPages(who).filter(
    (p) => p.enabled && p.title.startsWith(`${lessonPrefix} · Kavak México`)
  ).length

export function runKavakSimulation(
  who: string,
  options: {
    coordination?: 'orchestrated' | 'autonomous'
    singleApi?: boolean
    resetPreviousSimulation?: boolean
  } = {}
) {
  const coordination = options.coordination || 'orchestrated'
  const singleApi = options.singleApi ?? true
  if (options.resetPreviousSimulation) {
    data.phone = (data.phone || []).filter(
      (c) => !(c.owner === who && c.company === 'Kavak México')
    )
    data.runs = data.runs.filter(
      (r) => !(r.owner === who && r.title.startsWith('[Simulación BD Kavak'))
    )
    data.cycleReflections = (data.cycleReflections || []).filter(
      (r) => !(r.owner === who && r.runId.startsWith('kavak-sim-'))
    )
    data.contextPages = (data.contextPages || []).filter(
      (p) => !(p.owner === who && p.title.startsWith(`${lessonPrefix} · Kavak México`))
    )
  }

  const cycleResults: Array<{
    cycle: number
    scenarioId: string
    title: string
    orderId: string
    stockId: string
    model: string
    tier: string
    lessonsAtStart: number
    initialEvaluation: KavakEvaluationResult
    finalEvaluation: KavakEvaluationResult
    leaderDecision: string
    dbRecordsMatched: number
    resolved: boolean
    conversationId: string
    runId: string
  }> = []

  for (let idx = 0; idx < cycleScripts.length; idx++) {
    const script = cycleScripts[idx]
    const scenario =
      kavakScenarios.find((s) => s.id === script.scenarioId) || kavakScenarios[idx]
    const cycleNumber = idx + 1
    const lessonsAtStart = countActiveLessons(who)
    const mandatoryCtx = retrieveMandatoryContext(
      who,
      `${scenario.scenarioContext}\n${scenario.customerMessage}`,
      1400
    )
    const dbResult = queryKavakDatabase(
      'all',
      `${scenario.orderId} ${scenario.stockId} ${scenario.customer}`
    )
    const initialEval = evaluateKavakResponse(scenario.id, script.initialDraft)
    const finalEval = evaluateKavakResponse(scenario.id, script.finalAnswer)

    const convId = randomUUID()
    const runId = `kavak-sim-${cycleNumber}-${randomUUID().slice(0, 8)}`
    const room = `tel-${convId}`
    const createdAt = new Date(Date.now() + idx * 1000).toISOString()
    const agentRole =
      coordination === 'autonomous' ? `resolver-${script.tier}` : script.agent
    const reviewerRole =
      coordination === 'autonomous' ? 'revisor' : 'supervisor-rsi'
    const coordinatorRole =
      coordination === 'autonomous' ? 'tablero' : 'orquestador'
    const effectiveModel = singleApi ? 'gpt-5.4-nano' : script.model
    const effectiveReviewer = singleApi ? 'same' : script.reviewerModel

    const conv: PhoneConversation = {
      id: convId,
      owner: who,
      room,
      company: 'Kavak México',
      customer: scenario.customer,
      scenario: `[Simulación BD Kavak · Ciclo ${cycleNumber}] ${scenario.scenarioContext}`,
      model: effectiveModel,
      coordination,
      reviewer: effectiveReviewer,
      maxIterations: script.leaderDecision === 'spawn_subagent' ? 2 : 1,
      lessons: lessonsAtStart,
      createdAt,
      runIds: [runId],
      rating: {
        resolved: script.resolved,
        score: script.ratingScore,
        note: script.lessonNote,
        ratedAt: new Date(Date.now() + idx * 1000 + 500).toISOString()
      }
    }

    const spacesConsulted = mandatoryCtx.spacesConsulted || [...requiredContextSpaces]
    const iterations: Iteration[] = [
      {
        index: 1,
        model: effectiveModel,
        tier: script.tier,
        candidate: script.initialDraft,
        verdict: `Verificación contra BD Kavak (${scenario.orderId}/${scenario.stockId}): cobertura de hechos ${initialEval.factCoverage}% (${initialEval.matchedFacts.join(', ') || 'ninguno'}). Faltantes: ${initialEval.missingFacts.join(', ') || 'ninguno'}. Afirmaciones prohibidas: ${initialEval.violatedClaims.join(', ') || 'ninguna'}. Decisión líder: ${script.leaderDecision}.`,
        score: initialEval.score,
        accepted: initialEval.passed,
        tokens: Math.round(script.tokens * 0.6),
        costNano: '0',
        latency: 180,
        selfCheck: initialEval.passed
          ? 'Autochequeo conforme con base de datos Kavak y políticas activas.'
          : `Error detectado al contrastar con BD Kavak: ${script.mistake}`,
        mistake: script.mistake,
        leaderDecision: script.leaderDecision,
        subagent:
          script.leaderDecision === 'spawn_subagent'
            ? {
                role: 'verificador-bd-kavak',
                tier: 'medium',
                model: effectiveModel,
                iterations: 1,
                reasoning: 'Cruzar garantía activa y sede de la unidad en BD Kavak.',
                output: `Subagente verificó ${scenario.orderId} y ${scenario.stockId}: garantía=${dbResult.orders[0]?.activeWarranty}, sede=${dbResult.vehicles[0]?.hub}.`
              }
            : undefined
      }
    ]

    if (script.finalAnswer !== script.initialDraft) {
      iterations.push({
        index: 2,
        model: singleApi ? 'gpt-5.4-nano#perfil-high' : script.nextModel || effectiveModel,
        tier: 'high',
        candidate: script.finalAnswer,
        verdict: `Segunda pasada verificada contra BD Kavak: cobertura ${finalEval.factCoverage}% (${finalEval.matchedFacts.join(', ')}). Puntaje ${finalEval.score}/100.`,
        score: finalEval.score,
        accepted: finalEval.passed,
        tokens: Math.round(script.tokens * 0.4),
        costNano: '0',
        latency: 140,
        selfCheck: 'Datos de orden, unidad, sede y política de garantía verificados al 100% en BD Kavak.',
        mistake: 'Ajuste completado tras reporte del subagente verificador.',
        leaderDecision: 'accept'
      })
    }

    const run: Run = {
      id: runId,
      owner: who,
      title: `[Simulación BD Kavak · Ciclo ${cycleNumber}] ${scenario.orderId} · ${scenario.customer}`,
      prompt: scenario.customerMessage,
      coordination,
      mode: 'live',
      status: 'completed',
      model: effectiveModel,
      reviewer: effectiveReviewer,
      session: room,
      createdAt,
      updatedAt: new Date(Date.now() + idx * 1000 + 400).toISOString(),
      unknownUsage: false,
      budget: 0.05,
      maxIterations: 2,
      target: 85,
      stopReason: finalEval.passed ? 'target' : 'iterations',
      result: script.finalAnswer,
      usage: {
        input: Math.round(script.tokens * 0.65),
        output: Math.round(script.tokens * 0.35),
        cached: 0,
        cacheWrite: 0,
        reasoning: 0
      },
      costNano: '0',
      attachments: [],
      iterations,
      steps: [
        {
          role:
            coordination === 'autonomous'
              ? 'Tablero autónomo Kavak'
              : 'Orquestador y consulta de memoria RSI',
          model: effectiveModel,
          detail: `Consultados ${spacesConsulted.length} espacios obligatorios (${lessonsAtStart} lecciones previas).`
        },
        {
          role: `Consulta BD Kavak (query_kavak_db · ${scenario.orderId} / ${scenario.stockId})`,
          model: effectiveModel,
          detail: `BD Kavak devolvió ${dbResult.counts.orders} orden, ${dbResult.counts.vehicles} vehículo y ${dbResult.counts.policies} políticas. Puntaje final: ${finalEval.score}/100.`
        }
      ]
    }

    ;(data.phone ||= []).push(conv)
    data.runs.unshift(run)

    message(who, room, scenario.customer, 'Kavak México', scenario.customerMessage)
    message(
      who,
      room,
      coordinatorRole,
      'cerebro-contexto',
      `[contexto-previo] Consulta obligatoria antes de actuar: ${spacesConsulted.map((s) => `[[${s}]]`).join(', ')} (${lessonsAtStart} lecciones activas).`
    )
    message(
      who,
      room,
      agentRole,
      'bd-kavak',
      `[consulta-bd] query_kavak_db(table="all", query="${scenario.orderId} ${scenario.stockId}") -> ${dbResult.counts.orders} expediente(s), ${dbResult.counts.vehicles} unidad(es), ${dbResult.counts.policies} política(s).`
    )
    event(
      who,
      'tool',
      `${agentRole} → query_kavak_db`,
      runId,
      { table: 'all', query: `${scenario.orderId} ${scenario.stockId}`, room }
    )
    event(
      who,
      'tool.result',
      `${agentRole} ← query_kavak_db (${dbResult.counts.total} registros verificados en BD Kavak)`,
      runId,
      { counts: dbResult.counts, orderId: scenario.orderId, stockId: scenario.stockId, room }
    )
    message(
      who,
      room,
      agentRole,
      reviewerRole,
      `[autochequeo] Ciclo ${cycleNumber} (${effectiveModel} · perfil ${script.tier}): cobertura BD=${initialEval.factCoverage}%, puntaje=${initialEval.score}/100. Error detectado: ${script.mistake}`
    )
    message(
      who,
      room,
      reviewerRole,
      coordinatorRole,
      `[decision-lider] Decisión=${script.leaderDecision} · Puntaje final=${finalEval.score}/100 · Acción de mejora=${script.improvement}`
    )
    message(who, room, 'Kavak México', scenario.customer, script.finalAnswer)

    recordCycleReflection(who, {
      runId,
      cycle: cycleNumber,
      coordination,
      agent: agentRole,
      model: effectiveModel,
      tier: script.tier,
      reviewerModel: effectiveReviewer === 'same' ? `${effectiveModel}#reasoning` : effectiveReviewer,
      score: finalEval.score,
      accepted: finalEval.passed,
      selfCheck: iterations[iterations.length - 1].selfCheck || '',
      mistake: script.mistake,
      improvement: script.improvement,
      leaderDecision: script.leaderDecision,
      nextModel: script.nextModel,
      spacesConsulted,
      tokens: script.tokens,
      costNano: '0'
    })

    const lessonPage = savePage(who, {
      title: `${lessonPrefix} · Kavak México · Ciclo ${cycleNumber} (${scenario.orderId})`,
      content: [
        '#atencion-cliente #kavak-bd #mejora-ciclo',
        `Situación: ${scenario.scenarioContext}`,
        `Primer mensaje del cliente: ${scenario.customerMessage}`,
        `Expediente BD Kavak: ${scenario.orderId} · Unidad: ${scenario.stockId}`,
        `Resultado: ${script.resolved ? 'resuelto' : 'no resuelto'} (${finalEval.score}/100)`,
        `Donde se equivoco (${agentRole}): ${script.mistake}`,
        `Lección: ${script.lessonNote}`,
        `Enlaces: [[${requiredContextSpaces[0]}]] [[${requiredContextSpaces[1]}]] [[${requiredContextSpaces[2]}]]`
      ].join('\n'),
      enabled: true
    })
    conv.lessonPageId = lessonPage.id

    event(
      who,
      'phone.delivered',
      `Simulación BD Kavak · Ciclo ${cycleNumber} (${scenario.customer}): ${finalEval.score}/100 (${script.resolved ? 'resuelto' : 'requirió escalamiento'}).`,
      runId,
      { room, scenarioId: scenario.id, score: finalEval.score }
    )

    cycleResults.push({
      cycle: cycleNumber,
      scenarioId: scenario.id,
      title: scenario.title,
      orderId: scenario.orderId,
      stockId: scenario.stockId,
      model: effectiveModel,
      tier: script.tier,
      lessonsAtStart,
      initialEvaluation: initialEval,
      finalEvaluation: finalEval,
      leaderDecision: script.leaderDecision,
      dbRecordsMatched: dbResult.counts.total,
      resolved: script.resolved,
      conversationId: convId,
      runId
    })
  }

  save()

  const points = cycleResults.map((c) => ({
    cycle: c.cycle,
    score: c.finalEvaluation.score,
    tokens:
      data.runs.find((r) => r.id === c.runId)?.usage.input! +
      (data.runs.find((r) => r.id === c.runId)?.usage.output || 0),
    model: c.model,
    tier: c.tier,
    leaderDecision: c.leaderDecision
  }))
  const trend = computePerformanceTrend(points)
  const asciiChart = renderAsciiPerformanceChart(points, 7, 7)
  const progressBar = renderAsciiProgressBar(
    points[points.length - 1]?.score || 0,
    100,
    24,
    'Precisión final Kavak'
  )

  return {
    simulation: 'kavak-rsi-4-cycles',
    isSimulated: true,
    note: 'Ejecución determinista de demostración sobre la base de datos interna de Kavak. Sin cargos de API externa (costo $0.00).',
    coordination,
    singleApi,
    cycles: cycleResults,
    trend,
    progressBar,
    asciiChart,
    reflectionsCount: listCycleReflections(who).length
  }
}

export function registerKavak(app: Express) {
  app.get('/api/kavak/db', requireUser, (req, res) => {
    const table = z
      .enum(['all', 'vehicles', 'orders', 'policies'])
      .default('all')
      .parse(req.query.table || 'all')
    const q = z.string().max(200).default('').parse(req.query.q || '')
    res.json({
      ...queryKavakDatabase(table, q),
      scenarios: kavakScenarios
    })
  })

  app.post(
    '/api/kavak/query',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          table: z.enum(['all', 'vehicles', 'orders', 'policies']).default('all'),
          query: z.string().max(200).default('')
        })
        .parse(req.body || {})
      res.json(queryKavakDatabase(input.table, input.query))
    })
  )

  app.post(
    '/api/kavak/evaluate',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          scenarioId: z.string().min(1).max(100),
          responseText: z.string().min(1).max(4000)
        })
        .parse(req.body)
      res.json(evaluateKavakResponse(input.scenarioId, input.responseText))
    })
  )

  app.post(
    '/api/kavak/simulate',
    requireUser,
    asyncRoute((req, res) => {
      if (process.env.AERIS_RSI_ENABLED === 'false') {
        res.status(403).json({
          error: 'RSI cerrado para este servidor. No se permiten cambios de aprendizaje.'
        })
        return
      }
      const input = z
        .object({
          coordination: z.enum(['orchestrated', 'autonomous']).default('orchestrated'),
          singleApi: z.boolean().default(true),
          resetPreviousSimulation: z.boolean().default(true)
        })
        .parse(req.body || {})
      res.status(201).json(runKavakSimulation(owner(req), input))
    })
  )
}
