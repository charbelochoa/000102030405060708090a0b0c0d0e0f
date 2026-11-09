import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { Run } from '../shared/types'

const root = await mkdtemp(join(tmpdir(), 'aeris-autonomous-'))
process.env.AERIS_WORKSPACE = root
process.env.AERIS_DATA_DIR = root
process.env.AERIS_EMBEDDED = 'true'
process.env.AERIS_AUTH_REQUIRED = 'false'
process.env.AERIS_FIREBASE_URL = ''
for (const key of [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'XAI_API_KEY',
  'DEEPSEEK_API_KEY',
  'NVIDIA_API_KEY',
  'AERIS_LOCAL_API_KEY'
])
  delete process.env[key]
const { startServer } = await import('../server/index')
const { data, setKey, cliToken } = await import('../server/store')
const { server, port } = await startServer(0, '127.0.0.1')
const endpoint = `http://127.0.0.1:${port}/api`
const originalFetch = globalThis.fetch
after(async () => {
  globalThis.fetch = originalFetch
  server.closeAllConnections()
  await new Promise<void>((done) => server.close(() => done()))
  await rm(root, { recursive: true, force: true })
})
const template = data.settings.models.find((m) => m.provider === 'openai')!
data.settings.models = [
  { ...template, id: 'worker-small', tier: 'low', inputPrice: 1, outputPrice: 1 },
  { ...template, id: 'worker-large', tier: 'high', inputPrice: 2, outputPrice: 2 }
]
setKey('openai', 'mock-key')
const headers = { Authorization: `Bearer ${cliToken}`, 'Content-Type': 'application/json' }
async function run(input: object): Promise<Run> {
  const created = await originalFetch(`${endpoint}/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input)
  })
  assert.equal(created.status, 201)
  let result = (await created.json()) as Run
  for (let i = 0; i < 150 && ['running', 'queued'].includes(result.status); i++) {
    await delay(5)
    result = (await (
      await originalFetch(`${endpoint}/runs/${result.id}`, { headers })
    ).json()) as Run
  }
  assert.ok(!['running', 'queued'].includes(result.status))
  return result
}

test('both modes share accounting; autonomous workers skip LLM planning and correct via the board', async () => {
  const requests: any[] = []
  let reviews = 0
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com')) return originalFetch(url, init)
    const body = JSON.parse(String(init?.body))
    requests.push(body)
    const review = body.messages[0].content.includes('independent reviewer')
    return Response.json({
      model: body.model,
      choices: [
        {
          message: {
            content: review
              ? JSON.stringify({
                  score: ++reviews === 1 ? 40 : 95,
                  verdict: 'Evaluación de prueba',
                  improvements: 'Completar la respuesta.'
                })
              : 'Respuesta del trabajador'
          }
        }
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 }
    })
  }
  try {
    const autonomous = await run({
      prompt: 'Responde a la consulta',
      coordination: 'autonomous',
      maxIterations: 2,
      budget: 1,
      target: 90
    })
    assert.equal(autonomous.status, 'completed')
    assert.equal(autonomous.stopReason, 'target')
    assert.equal(autonomous.iterations.length, 2)
    assert.deepEqual(
      autonomous.tasks?.map((t) => [t.id, t.status]),
      [
        ['solve-1', 'completed'],
        ['review-1', 'completed'],
        ['solve-2', 'completed'],
        ['review-2', 'completed']
      ]
    )
    assert.equal(requests.length, 4)
    assert.equal(requests[0].model, 'worker-small')
    assert.equal(requests[2].model, 'worker-large')
    assert.equal(
      requests.some((r) => r.messages[0].content.includes('Plan this task')),
      false
    )
    assert.equal(
      autonomous.steps?.some((s) => s.role === 'plan'),
      false
    )
    const ledger = data.usageLedger!.filter((l) => l.runId === autonomous.id)
    assert.equal(ledger.length, 4)
    assert.equal(
      ledger.reduce((n, l) => n + BigInt(l.costNano), 0n).toString(),
      autonomous.costNano
    )
    const legacy = await run({ prompt: 'Saluda al cliente', model: 'worker-small', budget: 1 })
    assert.equal(legacy.coordination, 'orchestrated')
    assert.equal(legacy.status, 'completed')
    assert.equal(legacy.tasks, undefined)
    assert.equal(requests.length, 5)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('autonomous execution stops before calls above budget and after unknown usage', async () => {
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return Response.json({ choices: [{ message: { content: 'No usage' } }] })
  }
  try {
    const budget = await run({
      prompt: 'Consulta con límite',
      coordination: 'autonomous',
      budget: 0.001
    })
    assert.equal(budget.stopReason, 'budget')
    assert.equal(calls, 0)
    const unknown = await run({
      prompt: 'Consulta sin usage',
      coordination: 'autonomous',
      budget: 1
    })
    assert.equal(unknown.status, 'failed')
    assert.equal(unknown.unknownUsage, true)
    assert.equal(calls, 1)
    assert.equal(unknown.tasks?.[0].status, 'failed')
    assert.equal(unknown.tasks?.length, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('API validates the requested coordination mode', async () => {
  const response = await originalFetch(`${endpoint}/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: 'Consulta válida', coordination: 'invalid' })
  })
  assert.equal(response.status, 400)
})
