import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { analyze, inspect, storeFile, recoverFile } from './analysis'
import { data, event, getKey, save } from './store'
import {
  fileSchema,
  planSchema,
  type Profile,
  type Study,
  type Assessment,
  type Trial,
  type Strategy,
  type SearchMode,
  type Performance
} from '../shared/analysis'
import { selectProposal, operatorName } from './proposal-search'
import type { Attachment } from '../shared/types'

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
export function study(owner: string): Study {
  const all = (data.studies ||= {})
  const s: Study = (all[owner] ||= {
    historyVersion: 1,
    policies: [{ id: 'v1', createdAt: new Date().toISOString(), procedures: [] }],
    active: 'v1',
    cases: [],
    trials: [],
    experiments: []
  })
  if (s.historyVersion !== 1) {
    recoverDecisions(s, owner)
    s.historyVersion = 1
    save()
  }
  return s
}
function recoverDecisions(s: Study, owner: string) {
  const finished = new Map(
    data.runs.filter((r) => r.owner === owner).map((r) => [r.id, r.updatedAt])
  )
  for (const round of rounds(s))
    for (const d of round.experiments) {
      if (d.measured) continue
      const cases = round.cases.filter((c) => c.split === 'validation')
      const trials = round.trials.filter(
        (t) =>
          t.strategy === 'adaptive' &&
          t.completeUsage &&
          !t.error &&
          finished.has(t.runId) &&
          finished.get(t.runId)! <= d.createdAt
      )
      const paired = cases.map((c) => ({
        a: trials.findLast((t) => t.taskId === c.id && t.version === d.parent),
        b: trials.findLast((t) => t.taskId === c.id && t.version === d.candidate)
      }))
      if (
        !paired.length ||
        paired.length !== d.pairs ||
        paired.some((p) => !p.a || !p.b || p.a.configuration !== p.b.configuration) ||
        new Set(paired.map((p) => p.b!.configuration)).size !== 1
      )
        continue
      d.baseline = totals(paired.map((p) => p.a!))
      d.measured = totals(paired.map((p) => p.b!))
      d.configuration = paired[0].a!.configuration
      d.measurements = paired.map((p) => ({ previous: p.a!.runId, next: p.b!.runId }))
      d.regressions = paired.filter((p) => p.a!.success && !p.b!.success).length
      d.reconstructed = true
      const parent = s.policies.find((p) => p.id === d.parent),
        child = s.policies.find((p) => p.id === d.candidate)
      if (
        !parent ||
        !child ||
        child.procedures.length !== parent.procedures.length + 1 ||
        !parent.procedures.every((p) =>
          child.procedures.some(
            (q) => q.key === p.key && JSON.stringify(q.plan) === JSON.stringify(p.plan)
          )
        )
      )
        continue
      const change = child.procedures.find((q) => !parent.procedures.some((p) => p.key === q.key))
      const task = round.cases.find((c) => c.split === 'dev' && change?.evidence.includes(c.id))
      if (change && task)
        d.proposal = {
          mode: 'static',
          operator: operatorName(change.plan),
          key: change.key,
          question: task.prompt,
          action: 'add',
          acceptedBefore: 0,
          rejectedBefore: 0,
          evidence: change.evidence,
          history: []
        }
    }
}
function rounds(s: Study) {
  return [...(s.archives || []), s]
}
export function nextRound(owner: string) {
  const s = study(owner)
  if (!s.sealed || s.candidate)
    throw new Error('Cierra la evaluación final antes de iniciar otro ciclo.')
  if (
    s.cases.some(
      (c) =>
        c.split === 'test' &&
        !['static', 'adaptive'].every((strategy) =>
          s.trials.some(
            (t) =>
              t.taskId === c.id &&
              t.strategy === strategy &&
              (strategy !== 'adaptive' || t.version === s.active) &&
              t.completeUsage &&
              !t.error
          )
        )
    )
  )
    throw new Error('Completa el control y la política estable en todos los casos de test.')
  if ([...busy].some((key) => JSON.parse(key)[0] === owner))
    throw new Error('Hay mediciones en curso.')
  ;(s.archives ||= []).push({
    cases: s.cases,
    trials: s.trials,
    experiments: s.experiments,
    active: s.active
  })
  s.cases = []
  s.trials = []
  s.experiments = []
  s.sealed = false
  event(owner, 'study.round', 'Nuevo ciclo de aprendizaje.')
  return { round: s.archives.length + 1, active: s.active }
}
export function procedureKey(prompt: string, p: Profile) {
  return hash([
    prompt.normalize('NFKC').trim().replace(/\s+/g, ' '),
    p.columns?.map((c) => [c.name, c.type]),
    p.sheet
  ])
}
export function recall(
  owner: string,
  prompt: string,
  profile: Profile,
  version = study(owner).active
) {
  return study(owner)
    .policies.find((p) => p.id === version)
    ?.procedures.find((p) => p.key === procedureKey(prompt, profile))
}
const numberText = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/)
  .max(80)
export const caseSchema = z
  .object({
    prompt: z.string().trim().min(3).max(3000),
    file: fileSchema,
    sheet: z.string().max(160).optional(),
    split: z.enum(['dev', 'validation', 'test']),
    expected: z
      .array(z.object({ label: z.string().max(1000), value: numberText }))
      .min(1)
      .max(5000),
    plan: planSchema.optional()
  })
  .strict()
function canonical(rows: { label: string; value: string }[]) {
  return JSON.stringify(
    rows
      .map((r) => [
        r.label,
        r.value
          .replace(/(\.\d*?)0+$/, '$1')
          .replace(/\.$/, '')
          .replace(/^-0$/, '0')
      ])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  )
}
export async function addCase(
  owner: string,
  input: z.infer<typeof caseSchema>,
  sourceRunId?: string
) {
  const s = study(owner)
  const closed = () =>
    s.sealed || s.candidate || (input.split !== 'dev' && s.experiments.length > 0)
  if (closed()) throw new Error('El conjunto de evaluación está cerrado.')
  const cycle = s.archives?.length || 0
  const profile = await inspect(input.file, input.sheet)
  if (!profile.columns) throw new Error('El benchmark requiere una tabla.')
  if (input.plan && input.split !== 'dev')
    throw new Error('Solo desarrollo admite trazas de referencia.')
  function validatePartition() {
    if (
      closed() ||
      cycle !== (s.archives?.length || 0) ||
      rounds(s)
        .flatMap((r) => r.cases)
        .some(
          (c) =>
            (c.sha256 === profile.sha256 || (c.tableHash && c.tableHash === profile.tableHash)) &&
            (c.split !== input.split ||
              c.prompt === input.prompt ||
              (input.split !== 'dev' && !s.cases.includes(c)))
        )
    )
      throw new Error('Archivo duplicado entre particiones o caso ya registrado.')
  }
  validatePartition()
  if (input.plan) {
    const measured = await analyze(owner, randomUUID(), input.file, input.plan, input.sheet)
    if (canonical(measured.points) !== canonical(input.expected))
      throw new Error('El procedimiento contradice la respuesta de referencia.')
    validatePartition()
  }
  storeFile(owner, input.file)
  const task: Assessment = {
    id: randomUUID(),
    prompt: input.prompt,
    split: input.split,
    sha256: profile.sha256,
    tableHash: profile.tableHash,
    sourceRunId,
    source: input.file.name,
    mime: input.file.type,
    sheet: input.sheet,
    schemaKey: procedureKey(input.prompt, profile),
    expected: input.expected,
    plan: input.plan
  }
  s.cases.push(task)
  save()
  return { id: task.id, split: task.split }
}
export function propose(owner: string, mode: SearchMode = 'adaptive') {
  const s = study(owner)
  if (s.sealed) throw new Error('El test final cerró la optimización.')
  if (s.candidate) return s.policies.find((p) => p.id === s.candidate)!
  const history = rounds(s)
  const dev = history.flatMap((r) => r.cases.filter((c) => c.split === 'dev'))
  if (!s.cases.some((c) => c.split === 'validation'))
    throw new Error('Importa una partición de validación independiente.')
  const devIds = new Set(dev.map((c) => c.id))
  const next = selectProposal(
    dev,
    history.flatMap((r) => r.trials.filter((t) => devIds.has(t.taskId))),
    s.policies.find((p) => p.id === s.active)!,
    s.policies,
    history.flatMap((r) => r.experiments),
    mode
  )
  if (!next)
    throw new Error(
      'Sin cambios nuevos respaldados por desarrollo. Añade experiencias verificadas.'
    )
  const policy = { ...next, createdAt: new Date().toISOString() }
  s.policies.push(policy)
  s.candidate = policy.id
  event(
    owner,
    'memory.consolidated',
    'Propuesta de procedimiento ' + policy.proposal!.operator,
    undefined,
    { version: policy.id, proposal: policy.proposal }
  )
  return policy
}

function totals(trials: Trial[]): Performance {
  return {
    cases: trials.length,
    correct: trials.filter((t) => t.success).length,
    tokens: trials.reduce((n, t) => n + t.tokens, 0),
    calls: trials.reduce((n, t) => n + t.calls, 0),
    costNano: trials.reduce((n, t) => n + BigInt(t.costNano), 0n).toString(),
    latencyMs: trials.reduce((n, t) => n + t.latencyMs, 0)
  }
}
export function decide(owner: string, expected?: string) {
  const s = study(owner)
  if (expected && expected !== s.candidate)
    throw new Error('La candidata cambió antes de la decisión.')
  if (!s.candidate || s.sealed) throw new Error('Falta una candidata abierta.')
  const cases = s.cases.filter((c) => c.split === 'validation')
  const pairs = cases.map((c) => ({
    previous: s.trials.findLast(
      (t) => t.taskId === c.id && t.strategy === 'adaptive' && t.version === s.active
    ),
    next: s.trials.findLast(
      (t) => t.taskId === c.id && t.strategy === 'adaptive' && t.version === s.candidate
    ),
    control: s.trials.findLast((t) => t.taskId === c.id && t.strategy === 'static'),
    fixed: s.trials.findLast((t) => t.taskId === c.id && t.strategy === 'fixed')
  }))
  if (!pairs.length || pairs.some((p) => !p.next || !p.previous || !p.control || !p.fixed))
    throw new Error('Ejecuta las cuatro ramas en todos los casos de validación.')
  const usable = pairs.every((p) =>
    [p.previous!, p.next!, p.control!, p.fixed!].every(
      (t) => t.completeUsage && !t.error && t.configuration === p.next!.configuration
    )
  )
  if (!usable || new Set(pairs.map((p) => p.next!.configuration)).size !== 1)
    throw new Error(
      'Uso incompleto, error de ejecución o configuración distinta. Repite las ramas con la misma configuración.'
    )
  const passed = pairs.every((p) => p.next!.success)
  const sum = (which: 'next' | 'previous', field: 'costNano' | 'tokens') =>
    pairs.reduce((n, p) => n + BigInt(p[which]![field]), 0n)
  const gain =
    sum('next', 'costNano') <= sum('previous', 'costNano') &&
    sum('next', 'tokens') <= sum('previous', 'tokens') &&
    (sum('next', 'costNano') < sum('previous', 'costNano') ||
      sum('next', 'tokens') < sum('previous', 'tokens') ||
      pairs.some((p) => !p.previous!.success && p.next!.success))
  const accepted = passed && gain
  const experiment = {
    id: randomUUID(),
    parent: s.active,
    candidate: s.candidate,
    accepted,
    pairs: pairs.length,
    createdAt: new Date().toISOString(),
    proposal: s.policies.find((p) => p.id === s.candidate)?.proposal,
    round: (s.archives?.length || 0) + 1,
    regressions: pairs.filter((p) => p.previous!.success && !p.next!.success).length,
    baseline: totals(pairs.map((p) => p.previous!)),
    measured: totals(pairs.map((p) => p.next!)),
    configuration: pairs[0].next!.configuration,
    measurements: pairs.map((p) => ({ previous: p.previous!.runId, next: p.next!.runId })),
    reason: !passed
      ? 'Falló una respuesta de validación.'
      : !gain
        ? 'Sin mejora medida.'
        : 'Validación correcta y mejora medida.'
  }
  s.experiments.push(experiment)
  if (accepted) s.active = s.candidate
  delete s.candidate
  event(owner, 'policy.decision', experiment.reason)
  return experiment
}
export function restore(owner: string, id: string) {
  const s = study(owner)
  if (
    s.sealed ||
    s.candidate ||
    (id !== 'v1' &&
      !rounds(s).some((r) => r.experiments.some((e) => e.candidate === id && e.accepted)))
  )
    throw new Error('Versión no disponible para restauración.')
  s.active = id
  save()
  return { active: id }
}
const busy = new Set<string>()
export async function evaluate(
  owner: string,
  taskId: string,
  strategy: Strategy,
  version: string,
  budget: number
) {
  const s = study(owner),
    task = s.cases.find((c) => c.id === taskId)
  if (!task || !s.policies.some((p) => p.id === version))
    throw new Error('Caso o política desconocida.')
  if (strategy.startsWith('team') && (task.split !== 'dev' || s.candidate || s.sealed))
    throw new Error('Compara equipos en desarrollo antes de abrir una candidata.')
  if (
    task.split === 'test' &&
    (!s.experiments.length || s.candidate || (strategy === 'adaptive' && version !== s.active))
  )
    throw new Error('Cierra la selección antes del test.')
  if (s.sealed && task.split !== 'test') throw new Error('El test final ya comenzó.')
  if (task.split === 'test') {
    s.sealed = true
    save()
  }
  const config = hash([
    data.settings.models,
    data.settings.providers.map(({ hasKey, ...p }) => ({ ...p, available: !!getKey(p.id) })),
    data.settings.routerModel,
    budget
  ])
  const key = JSON.stringify([owner, task.id, strategy, version])
  if (busy.has(key)) throw new Error('Medición en curso.')
  const existing = s.trials.find(
    (t) =>
      t.taskId === task.id &&
      t.strategy === strategy &&
      t.version === version &&
      t.configuration === config &&
      !t.error
  )
  if (existing) return existing
  busy.add(key)
  try {
    const file = recoverFile(owner, task.sha256, task.source, task.mime)
    const { measuredAnalysis } = await import('./engine')
    const run = await measuredAnalysis(
      owner,
      task.prompt,
      file,
      task.sheet,
      strategy,
      version,
      budget
    )
    const { artifact } = await import('./analysis')
    const a = run.artifacts?.length ? artifact(owner, run.artifacts[0]) : undefined
    const trial: Trial = {
      taskId,
      runId: run.id,
      strategy,
      version,
      configuration: config,
      success: !!a && canonical(a.points) === canonical(task.expected),
      completeUsage: !run.unknownUsage,
      tokens: run.usage.input + run.usage.output,
      costNano: run.costNano,
      latencyMs: Date.parse(run.updatedAt) - Date.parse(run.createdAt),
      calls: run.calls?.length || 0,
      team: strategy.startsWith('team') ? run.calls?.map((c) => c.model) : undefined,
      recalled: !!run.steps?.some((step) => step.role === 'memory'),
      error: run.invalidPlan ? undefined : run.error,
      invalidPlan: run.invalidPlan ? run.error : undefined,
      plan: a?.plan
    }
    s.trials.push(trial)
    event(owner, 'study.measured', task.source, run.id)
    return trial
  } finally {
    busy.delete(key)
  }
}
export function studyView(owner: string) {
  const s = study(owner)
  return {
    active: s.active,
    candidate: s.candidate,
    sealed: !!s.sealed,
    policies: s.policies.map((p) => ({
      id: p.id,
      procedures: p.procedures.length,
      proposal: p.proposal,
      createdAt: p.createdAt
    })),
    round: (s.archives?.length || 0) + 1,
    experiments: rounds(s).flatMap((r) => r.experiments),
    cases: s.cases.map(({ id, source, split, plan }) => ({
      id,
      source,
      split,
      verifiedDev:
        split === 'dev' && (!!plan || s.trials.some((t) => t.taskId === id && t.success && t.plan))
    })),
    trials: s.trials.map(({ plan, ...t }) => t)
  }
}

export function publishedMemory(owner: string) {
  const s = study(owner),
    policy = s.policies.find((p) => p.id === s.active)!
  return {
    version: policy.id,
    procedures: policy.procedures.map((p) => {
      const cases = p.evidence
        .map((id) =>
          rounds(s)
            .flatMap((r) => r.cases)
            .find((c) => c.id === id && c.split === 'dev')
        )
        .filter((c) => !!c)
      return {
        key: p.key,
        query: cases[0]?.prompt,
        plan: p.plan,
        team: p.team,
        developmentRuns: p.developmentRuns,
        evidence: cases.map((c) => ({
          file: c.source,
          sha256: c.sha256,
          caseId: c.id,
          runId: c.sourceRunId
        }))
      }
    })
  }
}
