import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const endpoint = process.env.AERIS_URL || 'http://127.0.0.1:4318'
const token = (
  await readFile(join(process.env.AERIS_DATA_DIR || '.aeris', 'cli-token'), 'utf8')
).trim()
const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
async function api(path, body) {
  const r = await fetch(endpoint + '/api' + path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180000)
  })
  const json = await r.json()
  if (!r.ok) throw new Error(json.error)
  return json
}
const snap = await api('/snapshot')
const connected = snap.settings.providers.filter((p) => p.enabled && p.hasKey)
if (!connected.length || connected.some((p) => p.id !== 'local' && !p.freeTier))
  throw new Error(
    'Este estudio requiere exclusivamente proveedores locales o con cuota gratuita declarada.'
  )
if ((await api('/evolution')).cases.length)
  throw new Error('Ejecuta el estudio en un espacio de investigación nuevo.')
const sources = [],
  measurements = []
const tasks = [
  ['dev', 'Honda', 2022],
  ['dev', 'Ford', 2022],
  ['validation', 'Toyota', 2023],
  ['validation', 'Honda', 2023],
  ['validation', 'Chevrolet', 2021],
  ['validation', 'Volvo', 2020],
  ['test', 'Mazda', 2019],
  ['test', 'Ford', 2024]
]
for (const [split, make, year] of tasks) {
  const source = await api('/lab/vehicles?make=' + make + '&year=' + year)
  if (!source.count) throw new Error('Sin datos oficiales para ' + make)
  const raw = Buffer.from(JSON.stringify(source.records))
  const file = {
    name: make + '-' + year + '.json',
    type: 'application/json',
    data: raw.toString('base64')
  }
  const prompt =
    'Count all rows in this table. Return one overall total without grouping or filters.'
  const task = await api('/evolution/cases', {
    split,
    file,
    prompt,
    expected: [{ label: 'Total', value: String(source.count) }]
  })
  sources.push({
    id: task.id,
    split,
    make,
    year,
    count: source.count,
    source: source.source,
    retrievedAt: source.retrievedAt,
    sha256: createHash('sha256').update(raw).digest('hex')
  })
}
async function measure(task, strategy, version) {
  const result = await api('/benchmarks', { taskId: task.id, strategy, version, budget: 0.1 })
  measurements.push(result)
  process.stdout.write(
    [
      task.make,
      task.year,
      task.split,
      strategy,
      version,
      result.success,
      result.tokens,
      result.error || ''
    ].join(' ') + '\n'
  )
  if (result.error) throw new Error(result.error)
}
for (const task of sources.filter((t) => t.split === 'dev')) await measure(task, 'static', 'v1')
const candidate = await api('/optimizations', {})
const validation = sources.filter((t) => t.split === 'validation')
for (const [i, task] of validation.entries()) {
  const arms = [
    ['fixed', 'v1'],
    ['static', 'v1'],
    ['adaptive', 'v1'],
    ['adaptive', candidate.id]
  ]
  for (let k = 0; k < arms.length; k++) {
    const [strategy, version] = arms[(i + k) % arms.length]
    await measure(task, strategy, version)
  }
}
const decision = await api('/evolution/decide', {})
const active = (await api('/evolution')).active
for (const task of sources.filter((t) => t.split === 'test')) {
  await measure(task, 'static', 'v1')
  await measure(task, 'adaptive', active)
}
const final = await api('/snapshot')
const ids = new Set(measurements.map((t) => t.runId))
const ledger = final.ledger.filter((t) => ids.has(t.runId)).map(({ owner, id, ...r }) => r)
const report = {
  createdAt: new Date().toISOString(),
  protocol: 'vpic-row-count-1',
  providers: connected.map((p) => p.id),
  sources,
  measurements,
  ledger,
  decision
}
await writeFile(process.argv[2] || 'vpic-study.json', JSON.stringify(report, null, 2))
process.stdout.write(JSON.stringify(decision) + '\n')
