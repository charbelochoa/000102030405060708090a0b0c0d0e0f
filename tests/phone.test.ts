import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = await mkdtemp(join(tmpdir(), 'aeris-phone-'))
process.env.AERIS_WORKSPACE = root
process.env.AERIS_DATA_DIR = join(root, '.aeris')
process.env.AERIS_EMBEDDED = 'true'
process.env.AERIS_AUTH_REQUIRED = 'false'

for (const key of [
  'OPENAI_API_KEY',
  'NVIDIA_API_KEY',
  'AERIS_LOCAL_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'XAI_API_KEY',
  'DEEPSEEK_API_KEY'
])
  delete process.env[key]
const { startServer } = await import('../server/index')
const { cliToken, data, setKey } = await import('../server/store')
const { groupByLessons, buildRsiTrace, computePerformanceTrend, renderAsciiPerformanceChart } =
  await import('../shared/phone')
const { retrieveMandatoryContext } = await import('../server/brain')
const { server, port } = await startServer(0, '127.0.0.1')
const base = `http://127.0.0.1:${port}/api`
const headers = { Authorization: `Bearer ${cliToken}`, 'Content-Type': 'application/json' }

after(async () => {
  const delivered = () =>
    (data.phone || [])
      .flatMap((c) => c.runIds)
      .every((runId) =>
        data.events.some(
          (e) => e.runId === runId && ['phone.failed', 'phone.delivered'].includes(e.type)
        )
      )
  for (let i = 0; i < 100 && !delivered(); i++) await delay(20)
  assert.ok(
    delivered(),
    'Los turnos deben terminar su entrega antes de retirar el almacenamiento de prueba.'
  )
  server.closeAllConnections()
  await new Promise<void>((done) => server.close(() => done()))
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
})

async function call(path: string, body?: unknown, auth = true) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return { response, value: (await response.json()) as any }
}

test('phone conversations require authentication', async () => {
  assert.equal((await call('/phone/conversations', undefined, false)).response.status, 401)
})

test('phone keeps the selected coordination mode on its missions', async () => {
  const created = await call('/phone/conversations', {
    company: 'Tienda',
    customer: 'Ana',
    coordination: 'autonomous'
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.value.coordination, 'autonomous')
  const sent = await call(`/phone/conversations/${created.value.id}/messages`, {
    text: 'Consulta de prueba'
  })
  assert.equal(sent.response.status, 202)
  assert.equal(data.runs.find((r) => r.id === sent.value.runIds[0])?.coordination, 'autonomous')
})

test('a conversation records the customer message and reports a failed turn without inventing a reply', async () => {
  const created = await call('/phone/conversations', {
    company: 'Tienda Ejemplo',
    customer: 'Ana',
    scenario: 'Pregunta por una devolución.'
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.value.lessons, 0)
  const id = created.value.id
  const sent = await call(`/phone/conversations/${id}/messages`, {
    text: 'Hola, quiero devolver un pedido'
  })
  assert.equal(sent.response.status, 202)
  assert.equal(sent.value.messages[0].from, 'Ana')
  let latest = sent.value
  for (let i = 0; i < 40 && latest.pending; i++) {
    await delay(150)
    latest = (await call('/phone/conversations')).value.find((c: any) => c.id === id)
  }
  assert.equal(latest.pending, false)
  for (let i = 0; i < 40 && !data.events.some((e) => e.type === 'phone.failed'); i++)
    await delay(100)
  assert.ok(data.events.some((e) => e.type === 'phone.failed'))
  assert.equal(latest.turns.length, 1)
  assert.notEqual(latest.turns[0].status, 'completed')
  assert.equal(latest.messages.filter((m: any) => m.from === 'Tienda Ejemplo').length, 0)
  assert.equal(latest.usage.calls, 0)
})

test('rating with a lesson stores context and later conversations count it', async () => {
  const first = (
    await call('/phone/conversations', { company: 'Tienda Ejemplo', customer: 'Luis' })
  ).value
  const rated = await call(`/phone/conversations/${first.id}/rating`, {
    resolved: false,
    score: 2,
    note: 'Debió pedir el número de pedido antes de prometer el reembolso.'
  })
  assert.equal(rated.response.status, 200)
  assert.equal(rated.value.rating.resolved, false)
  assert.ok(rated.value.lessonPageId)
  const pages = (await call('/context')).value.pages
  assert.ok(pages.some((p: any) => p.title.startsWith('Lección de atención')))
  const next = (
    await call('/phone/conversations', { company: 'Tienda Ejemplo', customer: 'Marta' })
  ).value
  assert.equal(next.lessons, 1)
  const again = await call(`/phone/conversations/${first.id}/rating`, {
    resolved: true,
    score: 4,
    note: 'Con el número de pedido se resolvió.'
  })
  assert.equal(again.response.status, 200)
  assert.equal(again.value.lessonPageId, rated.value.lessonPageId)
})

test('measurements group rated conversations by lessons available at the start', () => {
  const view = (lessons: number, resolved: boolean, tokens: number, cost: string) =>
    ({
      lessons,
      rating: { resolved, note: '', ratedAt: '' },
      usage: { input: tokens, output: 0, calls: 1, costNano: cost, latencyMs: 0 }
    }) as any
  const groups = groupByLessons([
    view(0, false, 100, '1000'),
    view(0, true, 300, '3000'),
    view(2, true, 100, '500'),
    { lessons: 2, usage: { input: 9, output: 9, calls: 0, costNano: '0', latencyMs: 0 } } as any
  ])
  assert.deepEqual(
    groups.map((g) => [g.lessons, g.conversations, g.resolved, g.tokens, g.costNano]),
    [
      [0, 2, 1, 400, '4000'],
      [2, 1, 1, 100, '500']
    ]
  )
})

test('CLI RSI trace maps agent dialogue and all seven stages while excluding external customer bubbles', () => {
  const trace = buildRsiTrace(
    [
      {
        id: 'e1',
        owner: 'u1',
        runId: 'r1',
        type: 'context.retrieved',
        text: '2 páginas relevantes',
        createdAt: '2026-11-09T18:00:01.000Z'
      },
      {
        id: 'e2',
        owner: 'u1',
        runId: 'r1',
        type: 'rsi.first_pass',
        text: 'Primera pasada con Caveman',
        createdAt: '2026-11-09T18:00:02.000Z'
      },
      {
        id: 'e3',
        owner: 'u1',
        runId: 'r1',
        type: 'routed',
        text: 'Asignado a modelo medio',
        createdAt: '2026-11-09T18:00:03.000Z'
      },
      {
        id: 'e4',
        owner: 'u1',
        runId: 'r1',
        type: 'workflow.plan',
        text: 'Verificar estado del pedido',
        createdAt: '2026-11-09T18:00:04.000Z'
      },
      {
        id: 'e5',
        owner: 'u1',
        runId: 'r1',
        type: 'iteration',
        text: 'Iteración 1: 92/100 · candidato aceptado',
        createdAt: '2026-11-09T18:00:06.000Z'
      },
      {
        id: 'e6',
        owner: 'u1',
        type: 'phone.rated',
        text: 'Lección añadida al contexto',
        createdAt: '2026-11-09T18:00:08.000Z',
        data: { room: 'tel-1' }
      }
    ],
    [
      {
        id: 'm0',
        owner: 'u1',
        room: 'tel-1',
        from: 'Ana',
        to: 'Tienda Ejemplo',
        text: 'Hola',
        createdAt: '2026-11-09T18:00:00.000Z'
      },
      {
        id: 'm1',
        owner: 'u1',
        room: 'tel-1',
        from: 'orquestador',
        to: 'equipo-rsi',
        text: 'Solicitud recibida',
        createdAt: '2026-11-09T18:00:05.000Z'
      },
      {
        id: 'm2',
        owner: 'u1',
        room: 'tel-1',
        from: 'supervisor-rsi',
        to: 'cerebro-contexto',
        text: 'Lección consolidada',
        createdAt: '2026-11-09T18:00:07.000Z'
      }
    ],
    { room: 'tel-1', runIds: ['r1'], customer: 'Ana', company: 'Tienda Ejemplo' }
  )
  assert.ok(!trace.some((l) => l.prefix.includes('Ana')))
  assert.deepEqual(
    trace.map((l) => l.stage),
    ['01', '02', '03', '04', '05', '06', '07', '07']
  )
})

test('context brain records cycle mistakes and improvements and renders linear performance charts', async () => {
  const c1 = await call('/context/reflections', {
    runId: 'run-rsi-1',
    cycle: 1,
    coordination: 'orchestrated',
    agent: 'constructor',
    model: 'gpt-5.4-nano',
    tier: 'low',
    reviewerModel: 'gpt-5.4',
    score: 62,
    accepted: true,
    selfCheck: 'Omití validar el número de pedido.',
    mistake: 'Prometió reembolso sin verificar el pedido.',
    improvement: 'Pedir siempre el identificador de pedido antes de confirmar.',
    leaderDecision: 'keep_small',
    nextModel: 'gpt-5.4-nano',
    tokens: 180
  })
  assert.equal(c1.response.status, 201)
  const c2 = await call('/context/reflections', {
    runId: 'run-rsi-1',
    cycle: 2,
    coordination: 'orchestrated',
    agent: 'constructor',
    model: 'gpt-5.4-nano',
    tier: 'low',
    reviewerModel: 'gpt-5.4',
    score: 78,
    accepted: true,
    selfCheck: 'Pedí el pedido pero faltó el plazo de devolución.',
    mistake: 'No indicó la ventana de 30 días.',
    improvement: 'Incluir plazo de 30 días y pasos de etiqueta.',
    leaderDecision: 'escalate_model',
    nextModel: 'gpt-5.4-mini',
    tokens: 210
  })
  assert.equal(c2.response.status, 201)
  const c3 = await call('/context/reflections', {
    runId: 'run-rsi-1',
    cycle: 3,
    coordination: 'orchestrated',
    agent: 'constructor',
    model: 'gpt-5.4-mini',
    tier: 'medium',
    reviewerModel: 'gpt-5.4',
    score: 94,
    accepted: true,
    selfCheck: 'Autochequeo validado con política completa.',
    mistake: 'Sin error crítico en este ciclo.',
    improvement: 'Conservar estructura verificada.',
    leaderDecision: 'accept',
    tokens: 240
  })
  assert.equal(c3.response.status, 201)
  const ctx = await call('/context')
  assert.equal(ctx.value.reflections.length, 3)
  assert.equal(ctx.value.requiredSpaces.length, 3)
  const retrieved = retrieveMandatoryContext('local', 'reembolso de pedido', 1200)
  assert.ok(retrieved.hits.some((h) => h.title === 'Espacio de errores y mejoras RSI'))
  const trend = computePerformanceTrend(
    ctx.value.reflections.map((r: any, i: number) => ({
      cycle: i + 1,
      score: r.score,
      tokens: r.tokens,
      model: r.model,
      tier: r.tier,
      leaderDecision: r.leaderDecision
    }))
  )
  assert.equal(trend.isLinearImprovement, true)
  assert.equal(trend.slope, 16)
  assert.ok(trend.rSquared > 0.99)
  const ascii = renderAsciiPerformanceChart(
    ctx.value.reflections.map((r: any, i: number) => ({
      cycle: i + 1,
      score: r.score,
      tokens: r.tokens,
      model: r.model,
      tier: r.tier,
      leaderDecision: r.leaderDecision
    })),
    7,
    7
  )
  assert.match(ascii, /Pipeline RSI: \[#{28}\] 100% \(7\/7\)/)
  assert.match(ascii, /mejora lineal consistente/)
})

test('single API and single LLM model runs multi-agent RSI loop, subagent and cognitive escalation', async () => {
  const originalFetch = globalThis.fetch
  const savedModels = structuredClone(data.settings.models)
  const savedRouter = data.settings.router
  data.settings.router = false
  const singleModel = {
    ...savedModels.find((m) => m.provider === 'openai')!,
    id: 'single-llm-hackathon',
    name: 'Single LLM Hackathon',
    tier: 'low' as const
  }
  data.settings.models = [singleModel]
  setKey('openai', 'hackathon-single-key')
  const usedModels: string[] = []
  const systemPrompts: string[] = []
  let reviewCall = 0
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com')) return originalFetch(url, init)
    const body = JSON.parse(String(init?.body))
    usedModels.push(body.model)
    const sys = String(body.messages[0]?.content || '')
    systemPrompts.push(sys)
    if (sys.includes('independent reviewer')) {
      reviewCall++
      return Response.json({
        model: body.model,
        choices: [
          {
            message: {
              content:
                reviewCall === 1
                  ? JSON.stringify({
                      score: 68,
                      verdict: 'Falta verificar política de garantía.',
                      improvements: 'Añadir validación de garantía de 1 año.',
                      selfCheck: 'Omití la cláusula de garantía.',
                      mistake: 'No consultó la garantía.',
                      leaderAction: 'spawn_subagent',
                      subagent: {
                        role: 'auditor-garantia',
                        tier: 'medium',
                        iterations: 1,
                        reasoning: 'Verificar condiciones de garantía con el mismo LLM.'
                      }
                    })
                  : JSON.stringify({
                      score: 95,
                      verdict: 'Validado con el apoyo del subagente.',
                      improvements: 'Ninguna.',
                      selfCheck: 'Autochequeo completo.',
                      mistake: 'Sin error crítico en este ciclo.',
                      leaderAction: 'accept'
                    })
            }
          }
        ],
        usage: { prompt_tokens: 30, completion_tokens: 15 }
      })
    }
    if (sys.includes('specialized subagent')) {
      return Response.json({
        model: body.model,
        choices: [{ message: { content: 'Garantía confirmada: 12 meses contra defectos.' } }],
        usage: { prompt_tokens: 20, completion_tokens: 10 }
      })
    }
    return Response.json({
      model: body.model,
      choices: [{ message: { content: 'Respuesta de candidato con un solo LLM.' } }],
      usage: { prompt_tokens: 25, completion_tokens: 12 }
    })
  }
  try {
    const created = (
      await call('/runs', {
        prompt: 'Revisa el código y las condiciones de garantía del módulo.',
        model: 'single-llm-hackathon',
        reviewer: 'same',
        maxIterations: 3,
        target: 90
      })
    ).value
    let run = created
    for (let i = 0; i < 80 && ['running', 'queued'].includes(run.status); i++) {
      await delay(10)
      run = (await call(`/runs/${created.id}`)).value
    }
    assert.equal(run.status, 'completed', run.error)
    assert.equal(run.iterations.length, 2)
    assert.ok(usedModels.every((m) => m === 'single-llm-hackathon'))
    assert.equal(usedModels.length, 5)
    assert.equal(run.iterations[0].tier, 'low')
    assert.equal(run.iterations[1].tier, 'medium')
    assert.equal(run.iterations[0].subagent?.model, 'single-llm-hackathon')
    assert.ok(systemPrompts.some((s) => s.includes('Cognitive profile LOW')))
    assert.ok(systemPrompts.some((s) => s.includes('Cognitive profile MEDIUM')))
    assert.ok(systemPrompts.some((s) => s.includes('specialized subagent (auditor-garantia)')))
  } finally {
    globalThis.fetch = originalFetch
    data.settings.models = savedModels
    data.settings.router = savedRouter
    setKey('openai', '')
  }
})

test('Kavak server database queries and 4-cycle self-improvement simulation verify facts and linear improvement', async () => {
  const dbRes = await call('/kavak/db?table=all&q=ORD-9044')
  assert.equal(dbRes.response.status, 200)
  assert.equal(dbRes.value.orders.length, 1)
  assert.equal(dbRes.value.orders[0].orderId, 'ORD-9044')
  assert.equal(dbRes.value.orders[0].customer, 'Luis Hernández')
  assert.equal(dbRes.value.orders[0].daysSinceDelivery, 18)

  const simRes = await call('/kavak/simulate', {
    coordination: 'orchestrated',
    singleApi: true,
    resetPreviousSimulation: true
  })
  assert.equal(simRes.response.status, 201)
  assert.equal(simRes.value.cycles.length, 4)
  assert.equal(simRes.value.trend.isLinearImprovement, true)
  assert.ok(simRes.value.trend.slope > 10)
  assert.ok(simRes.value.trend.rSquared > 0.7)
  const scores = simRes.value.cycles.map((c: any) => c.finalEvaluation.score)
  assert.ok(scores[0] < scores[1] && scores[1] < scores[2] && scores[2] < scores[3])
  assert.equal(simRes.value.cycles[0].lessonsAtStart, 0)
  assert.equal(simRes.value.cycles[1].lessonsAtStart, 1)
  assert.equal(simRes.value.cycles[2].lessonsAtStart, 2)
  assert.equal(simRes.value.cycles[3].lessonsAtStart, 3)
  assert.match(simRes.value.asciiChart, /mejora lineal consistente/)
})
