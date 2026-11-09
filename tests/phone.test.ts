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
const { cliToken, data } = await import('../server/store')
const { groupByLessons, buildRsiTrace } = await import('../shared/phone')
const { server, port } = await startServer(0, '127.0.0.1')
const base = `http://127.0.0.1:${port}/api`
const headers = { Authorization: `Bearer ${cliToken}`, 'Content-Type': 'application/json' }

after(async () => {
  const delivered = () =>
    data.runs.every((r) =>
      data.events.some(
        (e) => e.runId === r.id && ['phone.failed', 'phone.delivered'].includes(e.type)
      )
    )
  for (let i = 0; i < 100 && !delivered(); i++) await delay(20)
  assert.ok(
    delivered(),
    'Los turnos deben terminar su entrega antes de retirar el almacenamiento de prueba.'
  )
  server.closeAllConnections()
  await new Promise<void>((done) => server.close(() => done()))
  await rm(root, { recursive: true, force: true })
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
