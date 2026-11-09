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
process.env.AERIS_FRONTEND_URL = 'https://test.github.io/aeris/'

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
const { data, cliToken, getKey, setKey } = await import('../server/store')
const { safePath } = await import('../server/tools')
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
  const local = await fetch(`${base}/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
    body: '{}'
  })
  assert.equal(local.status, 200)
  assert.equal((await call('/settings', { budget: -1 }, true, 'PATCH')).response.status, 400)
})

test('Pages origin supports preflight, bearer sessions and revocation', async () => {
  const origin = 'https://test.github.io'
  const preflight = await fetch(`${base}/auth/login`, {
    method: 'OPTIONS',
    headers: { Origin: origin }
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
  const local = await call('/auth/local', {}, false)
  const token = local.value.sessionToken
  assert.equal(typeof token, 'string')
  const remoteHeaders = {
    Origin: origin,
    Authorization: `Bearer ${token}`,
    'Sec-Fetch-Site': 'cross-site'
  }
  const snapshot = await fetch(`${base}/snapshot`, { headers: remoteHeaders })
  assert.equal((await snapshot.json()).user.id, 'local')
  assert.equal(
    (await fetch(`${base}/auth/logout`, { method: 'POST', headers: remoteHeaders })).status,
    200
  )
  assert.equal(
    (
      await fetch(`${base}/runs`, {
        method: 'POST',
        headers: { ...remoteHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test' })
      })
    ).status,
    401
  )
})

test('RSI can be paused without deleting previous experiments', async () => {
  process.env.AERIS_RSI_ENABLED = 'false'
  try {
    assert.equal((await call('/optimizations', {})).response.status, 403)
    assert.equal((await call('/evolution')).response.status, 200)
    assert.equal((await call('/snapshot')).value.rsiEnabled, false)
  } finally {
    delete process.env.AERIS_RSI_ENABLED
  }
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

test('new workspaces are empty and reject retired demo sessions and runs', async () => {
  assert.equal((await call('/snapshot')).value.runs.length, 0)
  assert.deepEqual((await call('/context')).value.pages, [])
  assert.equal(
    (await call('/runs', { prompt: 'Prueba de regresión', mode: 'demo' })).response.status,
    400
  )
  assert.equal((await call('/auth/demo', {})).response.status, 404)
  const run = (await call('/runs', { prompt: 'Objetivo sin proveedor' })).value
  assert.equal((await call('/runs/' + run.id)).value.status, 'failed')
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
  assert.equal(report.count, 0)
  const version = await execute(process.execPath, ['--import', 'tsx', cli, '--version'], options)
  assert.equal(version.stdout.trim(), '1.1.0')
})

test('análisis tabular completo, procedencia y protección de divisas', async () => {
  const file = {
    name: 'volumen.csv',
    type: 'text/csv',
    data: Buffer.from(
      'grupo,valor,moneda\n' +
        Array.from({ length: 50000 }, (_, i) => 'A,' + (i === 49999 ? 17 : 1) + ',MXN').join('\n')
    ).toString('base64')
  }
  const response = await call('/lab/analyze', {
    file,
    plan: { aggregation: 'sum', metric: 'valor', group_by: 'grupo' }
  })
  assert.equal(response.response.status, 200, JSON.stringify(response.value))
  assert.equal(response.value.rowsTotal, 50000)
  assert.deepEqual(response.value.points, [{ label: 'A', value: '50016', rows: 50000 }])
  assert.equal(response.value.verified, true)
  assert.match(response.value.sha256, /^[a-f0-9]{64}$/)
  const svg = await fetch(base + '/lab/artifacts/' + response.value.id + '/chart.svg', { headers })
  assert.equal(svg.status, 200)
  assert.match(await svg.text(), /50016/)
  const denied = await fetch(base + '/lab/artifacts/' + response.value.id, { headers: {} })
  assert.equal(denied.status, 401)
  const mixed = { ...file, data: Buffer.from('valor,moneda\n4,MXN\n2,USD').toString('base64') }
  assert.equal(
    (await call('/lab/analyze', { file: mixed, plan: { aggregation: 'sum', metric: 'valor' } }))
      .response.status,
    422
  )
})
test('el consolidador usa únicamente evidencias verificadas e independientes', async () => {
  const { addCase, propose, recall, decide, study, evaluate } = await import('../server/study')
  const { inspect } = await import('../server/analysis')
  const owner = 'study-test',
    prompt = 'Cuenta las filas.',
    plan = { aggregation: 'count' as const }
  const make = (rows: string) => ({
    name: 'tabla.csv',
    type: 'text/csv' as const,
    data: Buffer.from('columna\n' + rows).toString('base64')
  })
  const dev = {
    prompt,
    plan,
    split: 'dev' as const,
    file: make('a\nb'),
    expected: [{ label: 'Total', value: '2' }]
  }
  await assert.rejects(addCase(owner, { ...dev, expected: [{ label: 'Total', value: '8' }] }))
  await addCase(owner, dev)
  await assert.rejects(
    addCase(owner, { ...dev, plan: undefined, split: 'validation', file: make('b\na') })
  )
  const val = await addCase(owner, {
    ...dev,
    plan: undefined,
    split: 'validation',
    file: make('e\nf\ng'),
    expected: [{ label: 'Total', value: '3' }]
  })
  const p = propose(owner)
  assert.equal(recall(owner, prompt, await inspect(make('b\na'))), undefined)
  const t = await evaluate(owner, val.id, 'adaptive', p.id, 0.1)
  assert.equal(t.success, true)
  assert.equal(t.recalled, true)
  assert.equal(t.calls, 0)
  assert.throws(() => decide(owner), /cuatro ramas/)
  assert.equal(study(owner).active, 'v1')
})
test('recuperación documental acotada y unión con cobertura verificable', async () => {
  const { joinTables, searchDocument } = await import('../server/analysis')
  const f = (text: string, type = 'text/csv') => ({
    name: 'archivo',
    type,
    data: Buffer.from(text).toString('base64')
  })
  const doc = await searchDocument(
    'local',
    f('encabezado\n' + 'texto '.repeat(2000) + 'cláusula financiación', 'text/plain'),
    'financiación'
  )
  assert.ok(doc.hits.length && doc.hits.every((h) => h.text.length <= 1000))
  assert.ok(doc.hits[0].offset > 0)
  const left = f('id,v\na,1\nb,2'),
    right = f('id,marca\na,Ford')
  const joined = await joinTables(left, right, 'id', 'id')
  assert.equal(joined.rowsTotal, 2)
  assert.equal(joined.matched, 1)
  await assert.rejects(joinTables(left, f('id,v\na,1\na,2'), 'id', 'id'), /única/)
})

test('una experiencia de misión exige una referencia independiente y conserva la traza', async () => {
  const file = {
    name: 'cuentas.csv',
    type: 'text/csv',
    data: Buffer.from('activo\nsi\nno\nsi').toString('base64')
  }
  const { value: a } = await call('/lab/analyze', { file, plan: { aggregation: 'count' } })
  const uri = '/lab/artifacts/' + a.id + '/experience',
    prompt = 'Contar registros del libro'
  assert.equal(
    (await call(uri, { prompt, expected: [{ label: 'Total', value: '4' }] })).response.status,
    422
  )
  assert.equal(
    (await call(uri, { prompt, expected: [{ label: 'Total', value: '3' }] })).response.status,
    201
  )
  assert.equal(data.studies?.local.cases.at(-1)?.sourceRunId, a.runId)
})

test('las cifras de un modelo sin cálculo tabular no pasan la verificación', async () => {
  const original = globalThis.fetch
  setKey('openai', 'test-local-transport')
  let attempts = 0
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com/')) return original(url, init)
    attempts++
    return Response.json({
      model: 'gpt-5.4-mini',
      choices: [{ message: { content: 'El total es 438.' } }],
      usage: { prompt_tokens: 15, completion_tokens: 6 }
    })
  }
  try {
    const { value: r } = await call('/runs', {
      model: 'gpt-5.4-mini',
      prompt: 'Calcula el total',
      attachments: [
        {
          name: 'ventas.csv',
          type: 'text/csv',
          data: Buffer.from('valor\n2\n5').toString('base64')
        }
      ]
    })
    let run = r
    for (let i = 0; i < 50 && ['running', 'queued'].includes(run.status); i++) {
      await delay(10)
      run = (await call('/runs/' + r.id)).value
    }
    assert.equal(attempts, 2)
    assert.equal(run.status, 'failed')
    assert.equal(run.result, '')
    assert.match(run.error, /cálculo verificable/)
  } finally {
    globalThis.fetch = original
    setKey('openai', '')
  }
})

test('el resultado cuantitativo se publica con los valores del artefacto', async () => {
  const original = globalThis.fetch
  setKey('openai', 'test-local-transport')
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com/')) return original(url, init)
    const body = JSON.parse(String(init?.body))
    const evidence = body.messages.some((m: { role: string }) => m.role === 'tool')
    const message = evidence
      ? { content: 'La suma es 438.' }
      : {
          tool_calls: [
            {
              id: 'suma',
              type: 'function',
              function: {
                name: 'analyze_table',
                arguments: JSON.stringify({
                  file_index: 0,
                  plan: { aggregation: 'sum', metric: 'valor' }
                })
              }
            }
          ]
        }
    return Response.json({
      model: body.model,
      choices: [{ message }],
      usage: { prompt_tokens: 21, completion_tokens: 9 }
    })
  }
  try {
    const { value: created } = await call('/runs', {
      model: 'gpt-5.4-mini',
      prompt: 'Calcula la suma de valor',
      attachments: [
        {
          name: 'ventas.csv',
          type: 'text/csv',
          data: Buffer.from('valor\n2\n5').toString('base64')
        }
      ]
    })
    let run = created
    for (let i = 0; i < 150 && ['running', 'queued'].includes(run.status); i++) {
      await delay(30)
      run = (await call('/runs/' + created.id)).value
    }
    assert.equal(run.status, 'completed', run.error)
    assert.equal(run.result, 'ventas.csv\nTotal · 7')
    assert.equal(run.artifacts.length, 1)
  } finally {
    globalThis.fetch = original
    setKey('openai', '')
  }
})

test('una credencial asigna modelos distintos al plan, ejecución y revisión solicitada', async () => {
  const original = globalThis.fetch
  const roles: string[] = []
  setKey('openai', 'test-local-transport')
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com/')) return original(url, init)
    const request = JSON.parse(String(init?.body)),
      role = request.model
    roles.push(role)
    const content =
      role === 'gpt-5.4-nano'
        ? JSON.stringify({ tier: 'medium', steps: ['Inspeccionar la implementación'] })
        : role === 'gpt-5.4-mini'
          ? 'Revisión de la implementación solicitada.'
          : JSON.stringify({ score: 92, verdict: 'Revisado.', improvements: 'Ninguna.' })
    return Response.json({
      model: role,
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 25, completion_tokens: 12 }
    })
  }
  try {
    const { value: created } = await call('/runs', {
      prompt: 'Revisa el código de esta implementación.'
    })
    let run = created
    for (let i = 0; i < 50 && ['running', 'queued'].includes(run.status); i++) {
      await delay(10)
      run = (await call('/runs/' + created.id)).value
    }
    assert.equal(run.status, 'completed', run.error)
    assert.deepEqual(roles, ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4'])
    assert.equal(run.calls.length, 3)
    assert.ok(run.calls.every((c: { state: string }) => c.state === 'reported'))
  } finally {
    globalThis.fetch = original
    setKey('openai', '')
  }
})

test('la siguiente candidata aprende del rechazo y permite añadir desarrollo durante el estudio', async () => {
  const { addCase, propose, decide, study, studyView } = await import('../server/study')
  const owner = 'proposal-history',
    make = (n: number) => ({
      name: 'archivo.csv',
      type: 'text/csv' as const,
      data: Buffer.from('tipo\n' + Array(n).fill('A').join('\n')).toString('base64')
    })
  const count = { aggregation: 'count' as const },
    filtered = { ...count, filters: [{ column: 'tipo', equals: 'A' }] }
  const prompts = ['Contar todo A', 'Contar todo B', 'Contar todo C']
  for (const [i, prompt] of prompts.entries())
    await addCase(owner, {
      file: make(2),
      split: 'dev',
      prompt,
      expected: [{ label: 'Total', value: '2' }],
      plan: i === 2 ? count : filtered
    })
  const v = await addCase(owner, {
    file: make(3),
    split: 'validation',
    prompt: prompts[0],
    expected: [{ label: 'Total', value: '3' }]
  })
  const state = study(owner),
    first = propose(owner)
  assert.equal(first.proposal?.question, prompts[0])
  for (const [i, strategy] of (['fixed', 'static', 'adaptive', 'adaptive'] as const).entries())
    state.trials.push({
      taskId: v.id,
      runId: 'controlled-' + i,
      strategy,
      version: i === 3 ? first.id : 'v1',
      configuration: 'same',
      success: i !== 3,
      completeUsage: true,
      costNano: '0',
      tokens: i === 3 ? 0 : 100,
      calls: i === 3 ? 0 : 1,
      latencyMs: 3,
      recalled: i === 3
    })
  const rejection = decide(owner, first.id)
  assert.equal(rejection.accepted, false)
  assert.equal(rejection.regressions, 1)
  assert.deepEqual(rejection.measurements, [{ previous: 'controlled-2', next: 'controlled-3' }])
  await assert.rejects(
    addCase(owner, {
      file: make(4),
      split: 'validation',
      prompt: prompts[0],
      expected: [{ label: 'Total', value: '4' }]
    }),
    /cerrado/
  )
  await addCase(owner, {
    file: make(4),
    split: 'dev',
    prompt: prompts[2],
    plan: count,
    expected: [{ label: 'Total', value: '4' }]
  })
  data.studies!['fixed-control'] = structuredClone(state)
  assert.equal(propose('fixed-control', 'static').proposal?.question, prompts[1])
  const next = propose(owner, 'adaptive')
  assert.equal(next.proposal?.question, prompts[2])
  assert.deepEqual(next.proposal?.history, [rejection.id])
  assert.equal(next.proposal?.evidence.length, 2)
  assert.throws(() => decide(owner, first.id), /cambió/)
  assert.equal(studyView(owner).experiments[0].measured?.correct, 0)
  assert.equal(state.active, 'v1')
})

test('el planificador puede delegar un análisis y entregar su respuesta al constructor', async () => {
  const original = globalThis.fetch
  setKey('openai', 'controlled')
  const roles: string[] = []
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com/')) return original(url, init)
    const body = JSON.parse(String(init?.body))
    const index = roles.push(body.model)
    if (index === 3)
      assert.ok(
        body.messages.some((m: { content: unknown }) =>
          String(m.content).includes('revisar los nulos')
        )
      )
    const content =
      index === 1
        ? JSON.stringify({
            tier: 'medium',
            steps: ['Estudiar la calidad de los datos'],
            handoffs: [{ task: 'Diseñar el criterio de calidad', tier: 'high' }]
          })
        : index === 2
          ? 'Conviene revisar los nulos.'
          : 'Se preparó el criterio.'
    return Response.json({
      model: body.model,
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 12, completion_tokens: 8 }
    })
  }
  try {
    let run = (await call('/runs', { prompt: 'Organiza un análisis de calidad de los datos' }))
      .value
    for (let i = 0; i < 120 && ['queued', 'running'].includes(run.status); i++) {
      await delay(20)
      run = (await call('/runs/' + run.id)).value
    }
    assert.equal(run.status, 'completed', run.error)
    assert.equal(roles.length, 3)
    assert.deepEqual(
      run.steps
        .filter((s: { role: string }) => ['delegate', 'handoff'].includes(s.role))
        .map((s: { role: string }) => s.role),
      ['delegate', 'handoff']
    )
    assert.equal(run.calls.length, 3)
  } finally {
    globalThis.fetch = original
    setKey('openai', '')
  }
})
test('un nuevo ciclo conserva aprendizajes y bloquea archivos reservados anteriores', async () => {
  const { addCase, propose, nextRound, study, studyView, publishedMemory } =
    await import('../server/study')
  const owner = 'closed-round',
    s = study(owner)
  const source = (value: string) => ({
    name: 'tabla.csv',
    type: 'text/csv' as const,
    data: Buffer.from('x\n' + value).toString('base64')
  })
  const add = (split: 'dev' | 'validation' | 'test', value: string, prompt = 'Cuenta') =>
    addCase(owner, {
      split,
      prompt,
      file: source(value),
      expected: [{ label: 'Total', value: '1' }],
      plan: split === 'dev' ? { aggregation: 'count' } : undefined
    })
  await add('dev', 'A')
  await add('validation', 'B')
  const holdout = await add('test', 'C')
  const p = propose(owner)
  s.active = p.id
  delete s.candidate
  s.experiments.push({
    id: 'past',
    parent: 'v1',
    candidate: p.id,
    accepted: true,
    pairs: 1,
    reason: 'corrección verificada',
    createdAt: new Date().toISOString()
  })
  s.sealed = true
  assert.throws(() => nextRound(owner), /test/)
  for (const strategy of ['static', 'adaptive'] as const)
    s.trials.push({
      configuration: 'fixed',
      runId: strategy,
      taskId: holdout.id,
      strategy,
      version: s.active,
      success: true,
      completeUsage: true,
      tokens: 0,
      costNano: '0',
      latencyMs: 1,
      calls: 0,
      recalled: true
    })
  assert.equal(nextRound(owner).round, 2)
  assert.equal(publishedMemory(owner).procedures[0].query, 'Cuenta')
  assert.equal(studyView(owner).experiments[0].id, 'past')
  await assert.rejects(add('dev', 'C', 'Otra pregunta'), /duplicado/)
  await assert.rejects(add('validation', 'B', 'Otra pregunta'), /duplicado/)
  await add('validation', 'D')
  await add('dev', 'E', 'Cuántos registros')
  assert.equal(propose(owner).procedures.length, 2)
})

test('la campaña respeta la reserva restante antes de la siguiente rama', async () => {
  const { runCampaign } = await import('../shared/campaign')
  let calls = 0
  const fake = async <T>(path: string): Promise<T> => {
    if (path === '/evolution')
      return {
        active: 'v1',
        policies: [],
        sealed: false,
        cases: [{ id: 'x', split: 'validation' }]
      } as T
    if (path === '/optimizations') return { id: 'p-x', proposal: { mode: 'adaptive' } } as T
    assert.equal(path, '/benchmarks')
    calls++
    return { runId: 'r' + calls, completeUsage: true, costNano: '21000000' } as T
  }
  const result = await runCampaign(fake, {
    mode: 'adaptive',
    generations: 4,
    budget: 0.1,
    maxUsd: 0.12
  })
  assert.equal(calls, 1)
  assert.equal(result.reason, 'Presupuesto de la campaña alcanzado.')
  assert.equal(result.costNano, '21000000')
  assert.equal(result.decisions.length, 0)
})

test('la calibración mide las tres arquitecturas y solo ofrece equipos con aciertos verificados', async () => {
  const { addCase, evaluate, propose, study } = await import('../server/study')
  const { selectProposal } = await import('../server/proposal-search')
  const owner = 'team-calibration',
    prompt = 'Calcula el total de valor',
    file = (rows: string) => ({
      name: 'medida.csv',
      type: 'text/csv' as const,
      data: Buffer.from('valor\n' + rows).toString('base64')
    })
  const development = await addCase(owner, {
    prompt,
    file: file('4\n7'),
    split: 'dev',
    expected: [{ label: 'Total', value: '11' }]
  })
  const validation = await addCase(owner, {
    prompt,
    file: file('2\n8'),
    split: 'validation',
    expected: [{ label: 'Total', value: '10' }]
  })
  const original = globalThis.fetch
  setKey('openai', 'controlled')
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('api.openai.com/')) return original(url, init)
    const body = JSON.parse(String(init?.body)),
      plan =
        body.model === 'gpt-5.4'
          ? { aggregation: 'sum', metric: 'valor' }
          : { aggregation: 'count' }
    return Response.json({
      model: body.model,
      choices: [
        { message: { content: body.model === 'gpt-5.4-nano' ? 'sin JSON' : JSON.stringify(plan) } }
      ],
      usage: { prompt_tokens: 16, completion_tokens: 8 }
    })
  }
  try {
    const results = []
    for (const strategy of ['team1', 'team2', 'team3'] as const)
      results.push(await evaluate(owner, development.id, strategy, 'v1', 0.1))
    assert.deepEqual(
      results.map((t) => [t.calls, t.success]),
      [
        [1, false],
        [2, false],
        [3, true]
      ]
    )
    assert.ok(results[0].invalidPlan)
    assert.equal(results[0].error, undefined)
    assert.deepEqual(results[2].team, ['gpt-5.4-nano', 'gpt-5.4-mini', 'gpt-5.4'])
    await assert.rejects(evaluate(owner, validation.id, 'team3', 'v1', 0.1), /desarrollo/)
    const direct = propose(owner),
      s = study(owner)
    const alternative = selectProposal(
      s.cases.filter((c) => c.split === 'dev'),
      results,
      s.policies[0],
      s.policies,
      s.experiments,
      'adaptive'
    )
    assert.equal(direct.proposal?.operator, 'sum')
    assert.equal(alternative?.proposal?.operator, 'team/3')
    assert.deepEqual(alternative?.procedures[0].developmentRuns, [results[2].runId])
    s.policies.push({ ...alternative!, createdAt: new Date().toISOString() })
    const applied = await evaluate(owner, validation.id, 'adaptive', alternative!.id, 0.1)
    assert.equal(applied.calls, 3)
    assert.equal(applied.success, true)
    assert.equal(s.active, 'v1')
  } finally {
    globalThis.fetch = original
    setKey('openai', '')
  }
})
