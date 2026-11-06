import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const root = await mkdtemp(join(tmpdir(), 'aeris-test-'))
process.env.AERIS_WORKSPACE = root
process.env.AERIS_DATA_DIR = join(root, '.aeris')
process.env.AERIS_EMBEDDED = 'true'
process.env.AERIS_AUTH_REQUIRED = 'false'
process.env.AERIS_DEMO_DELAY = '2'
for (const key of [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY',
  'XAI_API_KEY',
  'DEEPSEEK_API_KEY'
])
  delete process.env[key]
const { startServer } = await import('../server/index')
const { data, cliToken, getKey, setKey } = await import('../server/store')
const { safePath } = await import('../server/tools')
const { evolution, optimize, rollback, gate, benchmarkPolicy } = await import('../server/evolution')
const { savePage, backlinks, retrieveContext } = await import('../server/brain')
const { server, port } = await startServer(0, '127.0.0.1')
const base = `http://127.0.0.1:${port}/api`
const headers = { Authorization: `Bearer ${cliToken}`, 'Content-Type': 'application/json' }

after(async () => {
  server.closeAllConnections()
  await new Promise<void>((done) => server.close(() => done()))
  await rm(root, { recursive: true, force: true })
})

async function call(path: string, body?: unknown, auth = true, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: auth ? headers : { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return { response, value: (await response.json()) as any }
}

test('health and authentication boundaries are enforced', async () => {
  assert.equal((await call('/health', undefined, false)).value.ok, true)
  assert.equal((await call('/files', undefined, false)).response.status, 403)
  assert.equal((await call('/runs', { prompt: 'Ejemplo de prueba' }, false)).response.status, 401)
  const rejected = await fetch(`${base}/settings`, {
    method: 'PATCH',
    headers: { ...headers, Origin: 'https://untrusted.invalid' },
    body: '{}'
  })
  assert.equal(rejected.status, 403)
  assert.equal((await call('/settings', { budget: -1 }, true, 'PATCH')).response.status, 400)
})

test('files cannot escape the workspace or reveal environment and application secrets', async () => {
  await writeFile(join(root, 'readme.md'), '# Local file')
  assert.equal((await call('/file?path=readme.md')).value.content, '# Local file')
  for (const path of [
    '../outside',
    '.env',
    '.aeris/master.key',
    '.git/config',
    '.AERIS/master.key',
    '.ENV',
    '.aeris./master.key',
    'NUL',
    'C:\\Windows\\win.ini'
  ]) {
    await assert.rejects(safePath(path))
  }
  assert.equal(
    (await call('/file', { path: 'new.txt', content: 'new' }, true, 'PUT')).response.status,
    422
  )
  await call('/settings', { allowWrites: true }, true, 'PATCH')
  assert.equal(
    (await call('/file', { path: 'nested/new.txt', content: 'new' }, true, 'PUT')).response.ok,
    true
  )
  assert.equal(await readFile(join(root, 'nested/new.txt'), 'utf8'), 'new')
  await call('/settings', { allowWrites: false }, true, 'PATCH')
})

test('symlink directories cannot escape path protection', async (t) => {
  const outside = await mkdtemp(join(tmpdir(), 'aeris-outside-'))
  try {
    try {
      await symlink(outside, join(root, 'linked'), 'junction')
    } catch (e) {
      if (['EPERM', 'EACCES'].includes((e as NodeJS.ErrnoException).code || '')) {
        t.skip('Host does not permit junction creation')
        return
      }
      throw e
    }
    await assert.rejects(safePath('linked/secret.txt'))
  } finally {
    await rm(join(root, 'linked'), { force: true }).catch(() => {})
    await rm(outside, { recursive: true, force: true })
  }
})

test('credentials are encrypted and never returned in public settings', async () => {
  setKey('openai', 'test-key-private-123')
  assert.equal(getKey('openai'), 'test-key-private-123')
  const snapshot = await call('/snapshot')
  assert.equal(snapshot.value.settings.providers.find((p: any) => p.id === 'openai').hasKey, true)
  assert.equal(JSON.stringify(snapshot.value).includes('test-key-private-123'), false)
  assert.equal(
    (await readFile(join(root, '.aeris/workspace.json'), 'utf8')).includes('test-key-private-123'),
    false
  )
  setKey('openai', '')
})

test('demo is cancellable and completes with an explicit stop reason', async () => {
  const created = (
    await call('/runs', {
      prompt: 'Verificar ciclo local',
      mode: 'demo',
      target: 70,
      maxIterations: 8
    })
  ).value
  let run = created
  for (let i = 0; i < 40 && ['running', 'queued'].includes(run.status); i++) {
    await delay(5)
    run = (await call(`/runs/${created.id}`)).value
  }
  assert.equal(run.mode, 'demo')
  assert.equal(run.status, 'completed')
  assert.equal(run.stopReason, 'target')
  assert.equal(run.iterations.length, 3)
  assert.match(run.result, /No se ejecutaron modelos/)
  const stopped = (await call('/runs', { prompt: 'Cancelar esta prueba', mode: 'demo' })).value
  await call(`/runs/${stopped.id}/stop`, {})
  assert.equal((await call(`/runs/${stopped.id}`)).value.stopReason, 'user')
})

test('independent authenticated accounts cannot read each other runs or control providers', async () => {
  const register = await call(
    '/auth/register',
    {
      email: 'aeris-test@example.invalid',
      name: 'Test account',
      password: 'long-enough-test-pass'
    },
    false
  )
  assert.equal(register.response.ok, true)
  const cookie = register.response.headers.get('set-cookie')!.split(';')[0]
  const localRun = data.runs.find((r) => r.owner === 'local')!
  const response = await fetch(`${base}/runs/${localRun.id}`, { headers: { Cookie: cookie } })
  assert.equal(response.status, 404)
  const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Cookie: cookie } })
  assert.equal(logout.ok, true)
  const expired = await fetch(`${base}/messages`, { headers: { Cookie: cookie } })
  assert.equal(expired.status, 401)
  const other = await call(
    '/auth/register',
    {
      email: 'aeris-other@example.invalid',
      name: 'Other account',
      password: 'another-long-test-pass'
    },
    false
  )
  const otherCookie = other.response.headers.get('set-cookie')!.split(';')[0]
  const forbidden = await fetch(`${base}/settings`, {
    method: 'PATCH',
    headers: { Cookie: otherCookie, 'Content-Type': 'application/json' },
    body: '{"allowWrites":true}'
  })
  assert.equal(forbidden.status, 403)
})

test('shared rooms preserve messages and SSE announces events', async () => {
  const signal = new AbortController()
  const stream = await fetch(`${base}/events`, {
    headers: { Authorization: `Bearer ${cliToken}` },
    signal: signal.signal
  })
  assert.match(stream.headers.get('content-type')!, /text\/event-stream/)
  const reader = stream.body!.getReader()
  await reader.read()
  await call('/messages', {
    room: 'team',
    from: 'atlas',
    to: 'nova',
    text: 'Verifica el filtro de inventario.'
  })
  const next = await reader.read()
  assert.match(new TextDecoder().decode(next.value), /atlas/)
  signal.abort()
  assert.equal((await call('/messages?room=team')).value[0].to, 'nova')
})

test('optimization automatically creates a candidate, validates independently and supports rollback', () => {
  const state = evolution()
  const before = structuredClone(state.versions[0])
  const result = optimize('local')
  assert.equal(result.status, 'accepted')
  assert.ok(result.candidate.quality > result.stable.quality)
  assert.equal(result.development.split, 'dev')
  assert.equal(result.candidate.split, 'validation')
  assert.equal(result.candidate.datasetHash, result.stable.datasetHash)
  assert.notEqual(result.development.datasetHash, result.candidate.datasetHash)
  assert.deepEqual(state.versions[0], before)
  assert.equal(
    state.reports.some((r) => r.split === 'test'),
    false
  )
  assert.equal(optimize('local').status, 'rejected')
  rollback('local', 'v1')
  assert.equal(state.stable, 'v1')
  assert.equal(gate(result.candidate, { ...result.candidate, quality: 10 }).accepted, false)
  assert.equal(gate(result.stable, { ...result.candidate, criticalErrors: 1 }).accepted, false)
  assert.equal(
    gate(result.stable, { ...result.candidate, datasetHash: 'different' }).accepted,
    false
  )
})

test('context graph supports backlinks, relevance budgets and owner isolation', () => {
  const one = savePage('local', {
    title: 'API Router',
    content: '- Seleccionar modelos económicos.\n- Respetar [[Presupuesto]] y #costes.'
  })
  savePage('local', {
    title: 'Presupuesto',
    content: '- Limitar gasto y tokens del router. #costes'
  })
  savePage('someone-else', { title: 'Secreto', content: 'API Router secret information' })
  assert.equal(backlinks('local', 'Presupuesto')[0].id, one.id)
  const result = retrieveContext('local', 'modelos económicos del router y costes', 120)
  assert.ok(result.estimatedTokens <= 120)
  assert.ok(result.hits.length > 0)
  assert.equal(result.text.includes('secret information'), false)
  assert.equal(retrieveContext('local', 'unrelatedxyz', 120).hits.length, 0)
  savePage('local', { id: one.id, title: one.title, content: one.content, enabled: false })
  assert.equal(
    retrieveContext('local', 'modelos económicos').hits.some((h) => h.pageId === one.id),
    false
  )
})

test('API-backed tool loop records builder and reviewer usage separately with mocked providers', async () => {
  const originalFetch = globalThis.fetch
  let builderCalls = 0
  const requests: any[] = []
  setKey('openai', 'mock-openai-key')
  setKey('anthropic', 'mock-anthropic-key')
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('api.openai.com')) {
      const payload = JSON.parse(String(init?.body))
      requests.push(payload)
      builderCalls++
      return new Response(
        JSON.stringify({
          model: 'gpt-5.4-mini-test-snapshot',
          choices: [
            {
              message:
                builderCalls === 1
                  ? {
                      content: null,
                      tool_calls: [
                        {
                          id: 'tool-1',
                          type: 'function',
                          function: { name: 'list_files', arguments: '{"path":"."}' }
                        }
                      ]
                    }
                  : { content: 'Resultado validado con el listado de archivos.' }
            }
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            prompt_tokens_details: { cached_tokens: 20 }
          }
        })
      )
    }
    if (url.includes('api.anthropic.com'))
      return new Response(
        JSON.stringify({
          model: 'claude-haiku-4-5-mock',
          content: [
            {
              type: 'text',
              text: '{"score":94,"verdict":"Validado con evidencia de herramienta.","improvements":"Sin cambios necesarios."}'
            }
          ],
          usage: { input_tokens: 100, output_tokens: 20 }
        })
      )
    return originalFetch(input, init)
  }
  try {
    const created = (
      await call('/runs', {
        prompt: 'Inspecciona los archivos del espacio',
        model: 'gpt-5.4-mini',
        reviewer: 'claude-haiku-4-5',
        mode: 'live'
      })
    ).value
    let run = created
    for (let i = 0; i < 60 && ['running', 'queued'].includes(run.status); i++) {
      await delay(5)
      run = (await call(`/runs/${created.id}`)).value
    }
    assert.equal(run.status, 'completed')
    assert.equal(run.stopReason, 'target')
    assert.equal(builderCalls, 2)
    assert.ok(
      requests[1].messages.some((m: any) => m.role === 'tool' && m.tool_call_id === 'tool-1')
    )
    const records = data.usageLedger!.filter((l) => l.runId === run.id)
    assert.equal(records.length, 3)
    assert.equal(records.filter((l) => l.provider === 'openai').length, 2)
    assert.equal(records.filter((l) => l.provider === 'anthropic').length, 1)
    assert.equal(run.costNano, '503000')
    assert.equal(records.reduce((sum, r) => sum + BigInt(r.costNano), 0n).toString(), run.costNano)
    assert.match(records[0].model, /test-snapshot/)
    assert.equal(records[0].tariff.id, 'gpt-5.4-mini')
    assert.ok(data.events.some((e) => e.runId === run.id && e.type === 'tool.result'))
  } finally {
    globalThis.fetch = originalFetch
    setKey('openai', '')
    setKey('anthropic', '')
  }
})

test('unknown usage prevents further API calls and does not fabricate accounting', async () => {
  const originalFetch = globalThis.fetch
  setKey('openai', 'mock-key')
  let calls = 0
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('api.openai.com')) {
      calls++
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'Respuesta sin uso reportado.' } }] })
      )
    }
    return originalFetch(input, init)
  }
  try {
    const created = (
      await call('/runs', {
        prompt: 'Comprobar uso desconocido',
        model: 'gpt-5.4-mini',
        mode: 'live'
      })
    ).value
    let run = created
    for (let i = 0; i < 40 && ['running', 'queued'].includes(run.status); i++) {
      await delay(5)
      run = (await call(`/runs/${created.id}`)).value
    }
    assert.equal(run.status, 'failed')
    assert.equal(run.unknownUsage, true)
    assert.equal(run.costNano, '0')
    assert.equal(calls, 1)
    assert.equal(data.usageLedger!.filter((l) => l.runId === run.id).length, 0)
  } finally {
    globalThis.fetch = originalFetch
    setKey('openai', '')
  }
})

test('CLI benchmark policy version does not collide with the application version flag', async () => {
  const execute = promisify(execFile)
  const cli = fileURLToPath(new URL('../cli/index.ts', import.meta.url))
  const options = { env: { ...process.env, AERIS_URL: `http://127.0.0.1:${port}` }, timeout: 20000 }
  const benchmark = await execute(
    process.execPath,
    ['--import', 'tsx', cli, 'benchmark', '--version', 'v1', '--split', 'dev'],
    options
  )
  const report = JSON.parse(benchmark.stdout)
  assert.equal(report.versionId, 'v1')
  assert.equal(report.split, 'dev')
  assert.equal(report.count, 20)
  const version = await execute(process.execPath, ['--import', 'tsx', cli, '--version'], options)
  assert.equal(version.stdout.trim(), '0.1.0')
})
