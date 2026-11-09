import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { runCampaign } from '../shared/campaign.ts'

const { values } = parseArgs({
  options: {
    'static-url': { type: 'string', default: 'http://127.0.0.1:4393' },
    'adaptive-url': { type: 'string', default: 'http://127.0.0.1:4394' },
    'static-data': { type: 'string' },
    'adaptive-data': { type: 'string' },
    provider: { type: 'string' },
    'max-usd': { type: 'string' },
    output: { type: 'string' }
  }
})
if (
  !values.provider ||
  !values.output ||
  !values['static-data'] ||
  !values['adaptive-data'] ||
  !values['max-usd']
)
  throw Error('Indica --static-data --adaptive-data --provider --max-usd --output.')
const cap = Number(values['max-usd'])
if (!Number.isFinite(cap) || cap < 0.4)
  throw Error('El presupuesto conjunto debe cubrir las cuatro reservas de USD 0.10.')
const budget = 0.1
const connections = {}
for (const mode of ['static', 'adaptive']) {
  const base = values[mode + '-url']
  const token = (await readFile(join(values[mode + '-data'], 'cli-token'), 'utf8')).trim()
  const api = async (path, body) => {
    const response = await fetch(base + '/api' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(150000)
    })
    const json = await response.json()
    if (!response.ok) throw Error(json.error)
    return json
  }
  const snap = await api('/snapshot')
  const connected = snap.settings.providers.filter((p) => p.enabled && p.hasKey).map((p) => p.id)
  if (connected.length !== 1 || connected[0] !== values.provider)
    throw Error('Activa solamente el proveedor elegido en cada espacio.')
  if ((await api('/evolution')).cases.length) throw Error('Utiliza dos estudios nuevos.')
  connections[mode] = api
}
const questions = [
  'Count all rows in the supplied table. Return one overall total without grouping or filters.',
  'Count all rows in this dataset. Return one overall total without grouping or filters.',
  'Count all rows in the attached table. Return one overall total without grouping or filters.',
  'Count all rows in this table. Return one overall total without grouping or filters.'
]
const sources = []
const modes = ['static', 'adaptive']
for (const [split, make, year] of [
  ['dev', 'Honda', 2022],
  ['validation', 'Toyota', 2023],
  ['test', 'Ford', 2024]
]) {
  const source = await connections.static('/lab/vehicles?make=' + make + '&year=' + year)
  const raw = Buffer.from(JSON.stringify(source.records))
  if (!source.count) throw Error('Fuente sin filas.')
  sources.push({
    split,
    make,
    year,
    url: source.source,
    retrievedAt: source.retrievedAt,
    rows: source.count,
    sha256: createHash('sha256').update(raw).digest('hex')
  })
  for (const [i, prompt] of questions.entries()) {
    const plan =
      split === 'dev'
        ? {
            aggregation: 'count',
            ...(i < 2
              ? { filters: [{ column: 'Make_Name', equals: source.records[0].Make_Name }] }
              : {})
          }
        : undefined
    for (const mode of modes)
      await connections[mode]('/evolution/cases', {
        split,
        prompt,
        plan,
        file: {
          name: make + '-' + year + '.json',
          type: 'application/json',
          data: raw.toString('base64')
        },
        expected: [{ label: 'Total', value: String(source.count) }]
      })
  }
}
const report = {
  protocol: 'proposal-order-v1',
  provider: values.provider,
  sources,
  questions,
  arms: {}
}
for (const mode of modes) {
  const api = connections[mode]
  const campaign = await runCampaign(
    api,
    { mode, generations: 4, budget, maxUsd: cap / 4 },
    (msg) => process.stdout.write(mode + ' ' + msg + '\n')
  )
  if (campaign.decisions.length !== 4)
    throw Error(campaign.reason + ' · ' + campaign.decisions.length + ' decisiones')
  const state = await api('/evolution'),
    dest = []
  let spent = 0n
  for (const task of state.cases.filter((c) => c.split === 'test')) {
    for (const [strategy, version] of [
      ['static', 'v1'],
      ['adaptive', state.active]
    ]) {
      if (spent + 100000000n > BigInt(Math.floor((cap / 4) * 1e9)))
        throw Error('Presupuesto de prueba final alcanzado.')
      const t = await api('/benchmarks', { taskId: task.id, strategy, version, budget })
      if (t.error || !t.completeUsage) throw Error(t.error || 'Uso incompleto.')
      spent += BigInt(t.costNano)
      dest.push({
        strategy,
        correct: t.success,
        tokens: t.tokens,
        calls: t.calls,
        costNano: t.costNano
      })
    }
  }
  const decisions = campaign.decisions.map((d) => ({
    accepted: d.accepted,
    operator: d.proposal.operator,
    question: d.proposal.question,
    history: d.proposal.history.length,
    regressions: d.regressions,
    before: d.baseline,
    after: d.measured
  }))
  const snapshot = await api('/snapshot')
  report.arms[mode] = {
    decisions,
    attemptsToFirstPromotion: decisions.findIndex((d) => d.accepted) + 1 || null,
    final: dest,
    calls: snapshot.ledger.length,
    tokens: snapshot.ledger.reduce((n, l) => n + l.usage.input + l.usage.output, 0),
    models: [...new Set(snapshot.ledger.map((l) => l.model))],
    costNano: snapshot.ledger.reduce((n, l) => n + BigInt(l.costNano), 0n).toString()
  }
}
report.recordedAt = new Date().toISOString()
await writeFile(values.output, JSON.stringify(report, null, 2) + '\n')
