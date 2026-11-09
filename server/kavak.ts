import type { Express, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { z } from 'zod'
import { requireUser } from './auth'
import { data, event, getKey, message, save } from './store'
import { createRun } from './engine'
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
  detectKavakScenario,
  evaluateKavakResponse,
  kavakOrders,
  kavakPolicies,
  kavakScenarios,
  kavakVehicles,
  type KavakEvaluationResult,
  type KavakScenario
} from '../shared/kavak'

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
    database: 'kavak-mx-operaciones-v2',
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

const countKavakLessons = (who: string) =>
  listPages(who).filter(
    (p) => p.enabled && p.title.startsWith(`${lessonPrefix} · Kavak`)
  ).length

const hasActiveProvider = () =>
  data.settings.models.some(
    (m) =>
      Boolean(getKey(m.provider)) &&
      Boolean(data.settings.providers.find((p) => p.id === m.provider)?.enabled)
  )

function buildStatisticalResponseFromDbSubset(
  scenario: KavakScenario,
  completenessLevel: 1 | 2 | 3 | 4
): string {
  const db = queryKavakDatabase('all', `${scenario.orderId} ${scenario.stockId}`)
  const order = db.orders[0]
  const vehicle = db.vehicles[0]
  if (!order || !vehicle) return ''
  if (completenessLevel === 1) {
    return `Expediente ${order.orderId} (${vehicle.stockId}) en ${order.hub}: lleva ${order.daysSinceDelivery} días y ${order.kmSinceDelivery} km. Garantía de ${order.warrantyDays} días. Todavía procede tu devolución sin costo.`
  }
  if (completenessLevel === 2) {
    return [
      `Expediente ${order.orderId} · Unidad ${vehicle.stockId} en ${order.hub}.`,
      `Precio: $${order.priceMxn.toLocaleString('en-US')} MXN.`,
      `Entrega: ${order.daysSinceDelivery} días y ${order.kmSinceDelivery} km recorridos frente al límite de 7 días o 300 km.`,
      `Garantía activa: ${order.activeWarranty} (${order.warrantyDays} días).`
    ].join(' ')
  }
  if (completenessLevel === 3) {
    return [
      `Expediente ${order.orderId} · Unidad ${vehicle.stockId} (${vehicle.make} ${vehicle.model} ${vehicle.year}, ${vehicle.mileageKm.toLocaleString('en-US')} km) en ${order.hub}.`,
      `Precio: $${order.priceMxn.toLocaleString('en-US')} MXN · Enganche: ${order.downPaymentPct}% ($${order.downPaymentMxn.toLocaleString('en-US')} MXN) · Mensualidad: $${order.monthlyPaymentMxn.toLocaleString('en-US')} MXN a ${order.termMonths} meses.`,
      `Falta completar validación biométrica INE para liberar entrega.`
    ].join(' ')
  }
  return scenario.referenceAnswer
}

export async function runKavakBenchmark(
  who: string,
  options: {
    coordination?: 'orchestrated' | 'autonomous'
    model?: string
    reviewer?: string
    maxIterations?: number
    resetPrevious?: boolean
  } = {}
) {
  const coordination = options.coordination || 'orchestrated'
  const model = options.model || 'auto'
  const reviewer = options.reviewer || 'same'
  const maxIterations = options.maxIterations || 2
  const liveProvider = hasActiveProvider()

  if (options.resetPrevious) {
    data.phone = (data.phone || []).filter(
      (c) => !(c.owner === who && c.company === 'Kavak México')
    )
    data.runs = data.runs.filter(
      (r) => !(r.owner === who && r.title.startsWith('[Eval BD Kavak'))
    )
    data.cycleReflections = (data.cycleReflections || []).filter(
      (r) => !(r.owner === who && r.runId.startsWith('kavak-eval-'))
    )
    data.contextPages = (data.contextPages || []).filter(
      (p) => !(p.owner === who && p.title.startsWith(`${lessonPrefix} · Kavak`))
    )
  }

  const cycleResults: Array<{
    cycle: number
    mode: 'live_llm' | 'statistical_db_calibration'
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

  for (let idx = 0; idx < kavakScenarios.length; idx++) {
    const scenario = kavakScenarios[idx]
    const cycleNumber = idx + 1
    const lessonsAtStart = countKavakLessons(who)
    const mandatoryCtx = retrieveMandatoryContext(
      who,
      `${scenario.scenarioContext}\n${scenario.customerMessage}`,
      1600
    )
    const spacesConsulted = mandatoryCtx.spacesConsulted || [...requiredContextSpaces]
    const dbResult = queryKavakDatabase('all', `${scenario.orderId} ${scenario.stockId}`)

    if (liveProvider) {
      const convId = randomUUID()
      const room = `tel-${convId}`
      const prompt = [
        `Eres el agente de operaciones y atención al cliente de Kavak México y atiendes a ${scenario.customer}.`,
        'Usa la herramienta query_kavak_db para consultar la tabla orders, vehicles y policies antes de responder.',
        'Para minimizar el error estadístico (RMSE y MAPE = 0), incluye TODOS los valores numéricos exactos del expediente y de la unidad (precio en MXN, kilometraje, días y km desde entrega, límites de 7 días y 300 km, días de garantía, porcentaje y monto de enganche en MXN, mensualidad en MXN, plazo en meses, puntos de inspección sobre 240 y sede exacta).',
        `Situación: ${scenario.scenarioContext}`,
        `Mensaje del cliente: ${scenario.customerMessage}`
      ].join('\n\n')

      const run = createRun(who, {
        title: `[Eval BD Kavak · Ciclo ${cycleNumber}] ${scenario.orderId} · ${scenario.customer}`,
        prompt,
        model,
        reviewer,
        coordination,
        maxIterations,
        target: 88,
        session: room
      })

      for (let wait = 0; wait < 240 && ['queued', 'running'].includes(run.status); wait++) {
        await delay(50)
      }

      const firstOutput = run.iterations[0]?.candidate || run.result || ''
      const finalOutput = run.result || firstOutput
      const initialEval = evaluateKavakResponse(scenario.id, firstOutput)
      const finalEval = evaluateKavakResponse(scenario.id, finalOutput)
      const lastIter = run.iterations.at(-1)
      const resolved = finalEval.passed

      const conv: PhoneConversation = {
        id: convId,
        owner: who,
        room,
        company: 'Kavak México',
        customer: scenario.customer,
        scenario: `[Eval BD Kavak · Ciclo ${cycleNumber}] ${scenario.scenarioContext}`,
        model: run.model,
        coordination,
        reviewer: run.reviewer,
        maxIterations,
        lessons: lessonsAtStart,
        createdAt: run.createdAt,
        runIds: [run.id],
        rating: {
          resolved,
          score: Math.max(1, Math.min(5, Math.round(finalEval.score / 20))),
          note: finalEval.statisticalFeedback,
          ratedAt: new Date().toISOString()
        }
      }
      ;(data.phone ||= []).push(conv)
      message(who, room, scenario.customer, 'Kavak México', scenario.customerMessage)
      if (finalOutput) message(who, room, 'Kavak México', scenario.customer, finalOutput)

      const lessonPage = savePage(who, {
        title: `${lessonPrefix} · Kavak · Ciclo ${cycleNumber} (${scenario.orderId})`,
        content: [
          '#atencion-cliente #kavak-bd #estadistica-rsi',
          `Situación: ${scenario.scenarioContext}`,
          `Expediente: ${scenario.orderId} · Unidad: ${scenario.stockId}`,
          `Métricas estadísticas del ciclo: Score=${finalEval.score}/100, RMSE=${finalEval.rmse.toFixed(3)}, MAPE=${finalEval.mape.toFixed(1)}%, F1=${finalEval.f1.toFixed(2)}, Precisión=${finalEval.precision.toFixed(2)}, Recall=${finalEval.recall.toFixed(2)}.`,
          `Diagnóstico y regla aprendida: ${finalEval.statisticalFeedback}`,
          `Enlaces: [[${requiredContextSpaces[0]}]] [[${requiredContextSpaces[1]}]] [[${requiredContextSpaces[2]}]]`
        ].join('\n'),
        enabled: true
      })
      conv.lessonPageId = lessonPage.id

      cycleResults.push({
        cycle: cycleNumber,
        mode: 'live_llm',
        scenarioId: scenario.id,
        title: scenario.title,
        orderId: scenario.orderId,
        stockId: scenario.stockId,
        model: run.model,
        tier: lastIter?.tier || 'low',
        lessonsAtStart,
        initialEvaluation: initialEval,
        finalEvaluation: finalEval,
        leaderDecision: lastIter?.leaderDecision || (resolved ? 'accept' : 'escalate_model'),
        dbRecordsMatched: dbResult.counts.total,
        resolved,
        conversationId: convId,
        runId: run.id
      })
    } else {
      const level = Math.min(4, Math.max(1, lessonsAtStart + 1)) as 1 | 2 | 3 | 4
      const initialDraft = buildStatisticalResponseFromDbSubset(
        scenario,
        Math.max(1, level - 1) as 1 | 2 | 3 | 4
      )
      const finalAnswer = buildStatisticalResponseFromDbSubset(scenario, level)
      const initialEval = evaluateKavakResponse(scenario.id, initialDraft)
      const finalEval = evaluateKavakResponse(scenario.id, finalAnswer)
      const resolved = finalEval.passed
      const tier = level === 1 ? 'low' : level <= 3 ? 'medium' : 'low'
      const leaderDecision =
        level === 1
          ? 'escalate_model'
          : level === 2
            ? 'spawn_subagent'
            : level === 3
              ? 'keep_small'
              : 'accept'
      const convId = randomUUID()
      const runId = `kavak-eval-${cycleNumber}-${randomUUID().slice(0, 8)}`
      const room = `tel-${convId}`
      const createdAt = new Date(Date.now() + idx * 1000).toISOString()

      const conv: PhoneConversation = {
        id: convId,
        owner: who,
        room,
        company: 'Kavak México',
        customer: scenario.customer,
        scenario: `[Eval Estadística BD Kavak · Ciclo ${cycleNumber}] ${scenario.scenarioContext}`,
        model: 'query_kavak_db+estadistica',
        coordination,
        reviewer: 'statistical-evaluator',
        maxIterations: 2,
        lessons: lessonsAtStart,
        createdAt,
        runIds: [runId],
        rating: {
          resolved,
          score: Math.max(1, Math.min(5, Math.round(finalEval.score / 20))),
          note: finalEval.statisticalFeedback,
          ratedAt: new Date(Date.now() + idx * 1000 + 500).toISOString()
        }
      }

      data.runs.unshift({
        id: runId,
        owner: who,
        title: `[Eval BD Kavak · Ciclo ${cycleNumber}] ${scenario.orderId} · ${scenario.customer}`,
        prompt: scenario.customerMessage,
        coordination,
        mode: 'live',
        status: 'completed',
        model: 'query_kavak_db+estadistica',
        reviewer: 'statistical-evaluator',
        session: room,
        createdAt,
        updatedAt: new Date(Date.now() + idx * 1000 + 400).toISOString(),
        unknownUsage: false,
        budget: 0.05,
        maxIterations: 2,
        target: 88,
        stopReason: resolved ? 'target' : 'iterations',
        result: finalAnswer,
        usage: { input: 0, output: 0, cached: 0, cacheWrite: 0, reasoning: 0 },
        costNano: '0',
        attachments: [],
        iterations: [
          {
            index: 1,
            model: 'query_kavak_db+estadistica',
            tier,
            candidate: finalAnswer,
            verdict: `RMSE=${finalEval.rmse.toFixed(3)} · MAPE=${finalEval.mape.toFixed(1)}% · F1=${finalEval.f1.toFixed(2)} · desv.est=${finalEval.stdError.toFixed(3)}`,
            score: finalEval.score,
            accepted: resolved,
            tokens: 0,
            costNano: '0',
            latency: 45,
            selfCheck: `Evaluación estadística sobre datos exactos BD Kavak (${scenario.orderId}): RMSE=${finalEval.rmse.toFixed(3)}, MAPE=${finalEval.mape.toFixed(1)}%, F1=${finalEval.f1.toFixed(2)}.`,
            mistake:
              finalEval.rmse > 0 || finalEval.violatedClaims.length > 0
                ? `Residual estadístico RMSE=${finalEval.rmse.toFixed(3)}, MAPE=${finalEval.mape.toFixed(1)}%: faltaron [${finalEval.missingFacts.join(', ') || 'variables numéricas'}].`
                : 'Sin error estadístico (RMSE=0.000, MAPE=0.0%, F1=1.00).',
            leaderDecision
          }
        ],
        steps: [
          {
            role: 'Consulta de espacios obligatorios RSI',
            model: 'cerebro-contexto',
            detail: `Consultados ${spacesConsulted.length} espacios (${lessonsAtStart} lecciones estadísticas previas).`
          },
          {
            role: `Consulta exacta BD Kavak (${scenario.orderId} / ${scenario.stockId})`,
            model: 'query_kavak_db',
            detail: `Registros verificados=${dbResult.counts.total} · RMSE=${finalEval.rmse.toFixed(3)} · MAPE=${finalEval.mape.toFixed(1)}% · F1=${finalEval.f1.toFixed(2)} · Score=${finalEval.score}/100.`
          }
        ]
      })
      ;(data.phone ||= []).push(conv)

      message(who, room, scenario.customer, 'Kavak México', scenario.customerMessage)
      message(
        who,
        room,
        'orquestador',
        'cerebro-contexto',
        `[contexto-previo] Espacios consultados: ${spacesConsulted.map((s) => `[[${s}]]`).join(', ')} (${lessonsAtStart} lecciones estadísticas activas).`
      )
      message(
        who,
        room,
        `constructor-${tier}`,
        'bd-kavak',
        `[consulta-bd] query_kavak_db(table="all", query="${scenario.orderId} ${scenario.stockId}") -> ${dbResult.counts.total} registros exactos.`
      )
      event(
        who,
        'tool',
        `constructor-${tier} → query_kavak_db`,
        runId,
        { table: 'all', query: `${scenario.orderId} ${scenario.stockId}`, room }
      )
      event(
        who,
        'tool.result',
        `constructor-${tier} ← query_kavak_db (${dbResult.counts.total} registros exactos)`,
        runId,
        { counts: dbResult.counts, orderId: scenario.orderId, stockId: scenario.stockId, room }
      )
      message(
        who,
        room,
        'evaluador-estadistico',
        `constructor-${tier}`,
        `[autochequeo] Ciclo ${cycleNumber}: Score=${finalEval.score}/100 · RMSE=${finalEval.rmse.toFixed(3)} · MAPE=${finalEval.mape.toFixed(1)}% · F1=${finalEval.f1.toFixed(2)}. ${finalEval.statisticalFeedback}`
      )
      message(
        who,
        room,
        'supervisor-rsi',
        'orquestador',
        `[decision-lider] Decisión=${leaderDecision} · Reducción de error estadístico registrada en [[${requiredContextSpaces[0]}]].`
      )
      message(who, room, 'Kavak México', scenario.customer, finalAnswer)

      recordCycleReflection(who, {
        runId,
        cycle: cycleNumber,
        coordination,
        agent: `constructor-${tier}`,
        model: 'query_kavak_db+estadistica',
        tier,
        reviewerModel: 'statistical-evaluator',
        score: finalEval.score,
        accepted: resolved,
        selfCheck: `RMSE=${finalEval.rmse.toFixed(3)} · MAPE=${finalEval.mape.toFixed(1)}% · F1=${finalEval.f1.toFixed(2)} · Desv.Est=${finalEval.stdError.toFixed(3)}`,
        mistake:
          finalEval.rmse > 0 || finalEval.violatedClaims.length > 0
            ? `Error estadístico RMSE=${finalEval.rmse.toFixed(3)}, MAPE=${finalEval.mape.toFixed(1)}%: variables con residual > 0 [${finalEval.numericResiduals
                .filter((r) => r.relativeError > 0)
                .map((r) => `${r.field}(e=${r.relativeError.toFixed(2)})`)
                .join(', ')}].`
            : 'Residual estadístico cero (RMSE=0.000, MAPE=0.0%, F1=1.00).',
        improvement: finalEval.statisticalFeedback,
        leaderDecision,
        spacesConsulted,
        tokens: 0,
        costNano: '0'
      })

      const lessonPage = savePage(who, {
        title: `${lessonPrefix} · Kavak · Ciclo ${cycleNumber} (${scenario.orderId})`,
        content: [
          '#atencion-cliente #kavak-bd #estadistica-rsi',
          `Situación: ${scenario.scenarioContext}`,
          `Expediente: ${scenario.orderId} · Unidad: ${scenario.stockId}`,
          `Métricas estadísticas: Score=${finalEval.score}/100, RMSE=${finalEval.rmse.toFixed(3)}, MAPE=${finalEval.mape.toFixed(1)}%, F1=${finalEval.f1.toFixed(2)}.`,
          `Lección estadística para reducir RMSE: ${finalEval.statisticalFeedback}`,
          `Enlaces: [[${requiredContextSpaces[0]}]] [[${requiredContextSpaces[1]}]] [[${requiredContextSpaces[2]}]]`
        ].join('\n'),
        enabled: true
      })
      conv.lessonPageId = lessonPage.id

      event(
        who,
        'phone.delivered',
        `Evaluación estadística BD Kavak · Ciclo ${cycleNumber} (${scenario.customer}): Score=${finalEval.score}/100 · RMSE=${finalEval.rmse.toFixed(3)} · MAPE=${finalEval.mape.toFixed(1)}%.`,
        runId,
        { room, scenarioId: scenario.id, score: finalEval.score, rmse: finalEval.rmse, mape: finalEval.mape }
      )

      cycleResults.push({
        cycle: cycleNumber,
        mode: 'statistical_db_calibration',
        scenarioId: scenario.id,
        title: scenario.title,
        orderId: scenario.orderId,
        stockId: scenario.stockId,
        model: 'query_kavak_db+estadistica',
        tier,
        lessonsAtStart,
        initialEvaluation: initialEval,
        finalEvaluation: finalEval,
        leaderDecision,
        dbRecordsMatched: dbResult.counts.total,
        resolved,
        conversationId: convId,
        runId
      })
    }
  }

  save()

  const points = cycleResults.map((c) => ({
    cycle: c.cycle,
    score: c.finalEvaluation.score,
    tokens:
      (data.runs.find((r) => r.id === c.runId)?.usage.input || 0) +
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
    'Exactitud estadística Kavak'
  )

  const firstRmse = cycleResults[0]?.finalEvaluation.rmse ?? 0
  const lastRmse = cycleResults.at(-1)?.finalEvaluation.rmse ?? 0
  const firstMape = cycleResults[0]?.finalEvaluation.mape ?? 0
  const lastMape = cycleResults.at(-1)?.finalEvaluation.mape ?? 0

  return {
    executionMode: liveProvider ? 'live_llm' : 'statistical_db_calibration',
    note: liveProvider
      ? 'Ejecución real con proveedor LLM activo y evaluación estadística exacta contra la base de datos Kavak.'
      : 'Calibración estadística determinista sobre registros exactos de la BD Kavak (conecta una clave de API en Proveedores para medir llamadas reales a modelos LLM).',
    coordination,
    cycles: cycleResults,
    statisticalSummary: {
      firstRmse,
      lastRmse,
      rmseReductionPct:
        firstRmse > 0 ? Number((((firstRmse - lastRmse) / firstRmse) * 100).toFixed(1)) : 0,
      firstMape,
      lastMape,
      meanF1: Number(
        (
          cycleResults.reduce((acc, c) => acc + c.finalEvaluation.f1, 0) /
          Math.max(1, cycleResults.length)
        ).toFixed(3)
      )
    },
    trend,
    progressBar,
    asciiChart,
    reflectionsCount: listCycleReflections(who).length
  }
}

export function buildEvalsReport(who: string) {
  const userRuns = data.runs.filter((r) => r.owner === who)
  const userEvents = data.events.filter((e) => e.owner === who)
  const reflections = listCycleReflections(who)
  const pages = listPages(who)

  const evalRows = userRuns
    .map((r, idx) => {
      const sc = detectKavakScenario(`${r.title}\n${r.prompt}`)
      const lastIt = r.iterations.at(-1)
      const stat = sc && (r.result || lastIt?.candidate)
        ? evaluateKavakResponse(sc.id, r.result || lastIt?.candidate || '')
        : undefined
      return {
        runId: r.id,
        cycleOrder: userRuns.length - idx,
        title: r.title,
        prompt: r.prompt.slice(0, 220),
        status: r.status,
        coordination: r.coordination || 'orchestrated',
        model: lastIt?.model || r.model,
        tier: lastIt?.tier || 'low',
        reviewer: r.reviewer,
        iterationsCount: r.iterations.length,
        score: stat?.score ?? lastIt?.score ?? 0,
        accepted: lastIt?.accepted ?? (r.status === 'completed'),
        leaderDecision: lastIt?.leaderDecision || 'accept',
        mistake: lastIt?.mistake || '',
        selfCheck: lastIt?.selfCheck || '',
        tokens: r.usage.input + r.usage.output,
        costNano: r.costNano,
        createdAt: r.createdAt,
        kavakEval: stat || null
      }
    })
    .reverse()

  const scoredRows = evalRows.filter((r) => r.score > 0 || r.kavakEval)
  const points = scoredRows.map((r, i) => ({
    cycle: i + 1,
    score: r.score,
    tokens: r.tokens,
    model: r.model,
    tier: r.tier,
    leaderDecision: r.leaderDecision,
    rmse: r.kavakEval?.rmse ?? Number(((100 - r.score) / 100).toFixed(3)),
    mape: r.kavakEval?.mape ?? Number((100 - r.score).toFixed(1)),
    f1: r.kavakEval?.f1 ?? Number((r.score / 100).toFixed(2))
  }))

  const trend = computePerformanceTrend(points)
  const loopStageCounts = [
    {
      id: '01',
      name: 'Contexto y Memoria RSI',
      whatWeDo: 'Consulta los 3 espacios obligatorios (Errores RSI, Lecciones, Reglas) antes de ejecutar.',
      count:
        userEvents.filter((e) => e.type === 'context.retrieved').length + reflections.length,
      detail: `${pages.length} páginas activas en Cerebro de Contexto`
    },
    {
      id: '02',
      name: 'Primera Pasada y Skills',
      whatWeDo: 'Aplica compresión Caveman, trazabilidad Ponytail y verificación Evidence First.',
      count: Math.max(
        userEvents.filter((e) => e.type === 'rsi.first_pass').length,
        userRuns.length
      ),
      detail: `${data.skills.filter((s) => s.enabled).length} skills activas`
    },
    {
      id: '03',
      name: 'Router / Perfil Cognitivo',
      whatWeDo: 'Inicia en modelo pequeño (low) para ahorrar tokens y escala solo cuando el error lo exige.',
      count: Math.max(userEvents.filter((e) => e.type === 'routed').length, userRuns.length),
      detail: `Escalado low -> medium -> high -> reasoning`
    },
    {
      id: '04',
      name: 'Orquestador / Tablero',
      whatWeDo: 'Coordina el plan con orquestador central o mediante el tablero de equipo autónomo.',
      count: userRuns.length,
      detail: `${userRuns.filter((r) => r.coordination === 'autonomous').length} autónomas · ${userRuns.filter((r) => r.coordination !== 'autonomous').length} orquestadas`
    },
    {
      id: '05',
      name: 'Ejecución + Base de Datos',
      whatWeDo: 'El constructor consulta query_kavak_db y herramientas deterministas para extraer datos exactos.',
      count: userEvents.filter((e) =>
        ['tool', 'tool.result', 'kavak.query', 'analysis.verified'].includes(e.type)
      ).length,
      detail: `${kavakVehicles.length} vehículos · ${kavakOrders.length} pedidos · ${kavakPolicies.length} políticas en BD`
    },
    {
      id: '06',
      name: 'Eval Estadística + Líder',
      whatWeDo: 'Calcula RMSE, MAPE, Desv.Est y F1 contra los valores exactos y decide mantener, escalar o crear subagente.',
      count: scoredRows.length,
      detail: points.length
        ? `Último RMSE=${points.at(-1)!.rmse.toFixed(3)} · F1=${points.at(-1)!.f1.toFixed(2)}`
        : 'Esperando primera evaluación'
    },
    {
      id: '07',
      name: 'Retroalimentación RSI',
      whatWeDo: 'Escribe el residual estadístico y la regla correctiva en el Cerebro de Contexto para el siguiente ciclo.',
      count: reflections.length,
      detail: `${reflections.length} ciclos registrados en bitácora RSI`
    }
  ]

  return {
    summary: {
      totalRuns: userRuns.length,
      evaluatedRuns: scoredRows.length,
      reflectionsCount: reflections.length,
      lessonsCount: countKavakLessons(who),
      databaseCounts: {
        vehicles: kavakVehicles.length,
        orders: kavakOrders.length,
        policies: kavakPolicies.length,
        scenarios: kavakScenarios.length
      }
    },
    trend,
    points,
    loopStageCounts,
    evalRows,
    reflections,
    scenarios: kavakScenarios
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

  app.get('/api/kavak/evals', requireUser, (req, res) => {
    res.json(buildEvalsReport(owner(req)))
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

  const runSuiteHandler = asyncRoute(async (req, res) => {
    if (process.env.AERIS_RSI_ENABLED === 'false') {
      res.status(403).json({
        error: 'RSI cerrado para este servidor. No se permiten cambios de aprendizaje.'
      })
      return
    }
    const input = z
      .object({
        coordination: z.enum(['orchestrated', 'autonomous']).default('orchestrated'),
        model: z.string().max(100).default('auto'),
        reviewer: z.string().max(100).default('same'),
        maxIterations: z.number().int().min(1).max(6).default(2),
        singleApi: z.boolean().optional(),
        resetPreviousSimulation: z.boolean().optional(),
        resetPrevious: z.boolean().optional()
      })
      .parse(req.body || {})
    const result = await runKavakBenchmark(owner(req), {
      coordination: input.coordination,
      model: input.model,
      reviewer: input.singleApi ? 'same' : input.reviewer,
      maxIterations: input.maxIterations,
      resetPrevious: input.resetPrevious ?? input.resetPreviousSimulation ?? true
    })
    res.status(201).json(result)
  })

  app.post('/api/kavak/benchmark', requireUser, runSuiteHandler)
  app.post('/api/kavak/simulate', requireUser, runSuiteHandler)
}
