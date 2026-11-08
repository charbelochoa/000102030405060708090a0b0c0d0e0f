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
  type Procedure,
  type AnalysisPlan
} from '../shared/analysis'
import type { Attachment } from '../shared/types'

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
export function study(owner: string): Study {
  const all = (data.studies ||= {})
  return (all[owner] ||= {
    policies: [{ id: 'v1', createdAt: new Date().toISOString(), procedures: [] }],
    active: 'v1',
    cases: [],
    trials: [],
    experiments: []
  })
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
  if (s.sealed || s.candidate || s.experiments.length)
    throw new Error('El conjunto de evaluación está cerrado.')
  const profile = await inspect(input.file, input.sheet)
  if (!profile.columns) throw new Error('El benchmark requiere una tabla.')
  if (input.plan && input.split !== 'dev')
    throw new Error('Solo desarrollo admite trazas de referencia.')
  if (input.plan) {
    const measured = await analyze(owner, randomUUID(), input.file, input.plan, input.sheet)
    if (canonical(measured.points) !== canonical(input.expected))
      throw new Error('El procedimiento contradice la respuesta de referencia.')
  }
  if (
    s.sealed ||
    s.candidate ||
    s.experiments.length ||
    s.cases.some(
      (c) =>
        (c.sha256 === profile.sha256 || (c.tableHash && c.tableHash === profile.tableHash)) &&
        (c.split !== input.split || c.prompt === input.prompt)
    )
  )
    throw new Error('Archivo duplicado entre particiones o caso ya registrado.')
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
export function propose(owner: string) {
  const s = study(owner)
  if (s.sealed) throw new Error('El test final cerró la optimización.')
  if (s.candidate) return s.policies.find((p) => p.id === s.candidate)!
  const dev = s.cases.filter((c) => c.split === 'dev')
  const groups = new Map<string, Procedure[]>()
  for (const c of dev) {
    const success = s.trials.filter((t) => t.taskId === c.id && t.success && t.plan)
    const plans: AnalysisPlan[] = [...(c.plan ? [c.plan] : []), ...success.map((t) => t.plan!)]
    for (const plan of plans) {
      const list = groups.get(c.schemaKey) || []
      const equal = list.find((p) => JSON.stringify(p.plan) === JSON.stringify(plan))
      if (equal) {
        if (!equal.evidence.includes(c.id)) equal.evidence.push(c.id)
      } else list.push({ key: c.schemaKey, plan, evidence: [c.id] })
      groups.set(c.schemaKey, list)
    }
  }
  const procedures = [...groups.values()].filter((v) => v.length === 1).flat()
  if (!procedures.length)
    throw new Error('Faltan planes de desarrollo verificados contra una respuesta independiente.')
  if (!s.cases.some((c) => c.split === 'validation'))
    throw new Error('Importa una partición de validación independiente.')
  const id = 'p-' + hash(procedures).slice(0, 12)
  if (s.policies.some((p) => p.id === id)) throw new Error('Esta configuración ya se evaluó.')
  const policy = { id, createdAt: new Date().toISOString(), procedures }
  s.policies.push(policy)
  s.candidate = id
  event(
    owner,
    'memory.consolidated',
    procedures.length + ' procedimientos consolidados.',
    undefined,
    { version: id, dev: dev.map((c) => c.id) }
  )
  return policy
}
export function decide(owner: string) {
  const s = study(owner)
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
  const passed = pairs.every((p) => p.next!.success)
  const sum = (which: 'next' | 'previous', field: 'costNano' | 'tokens') =>
    pairs.reduce((n, p) => n + BigInt(p[which]![field]), 0n)
  const gain =
    sum('next', 'costNano') <= sum('previous', 'costNano') &&
    sum('next', 'tokens') <= sum('previous', 'tokens') &&
    (sum('next', 'costNano') < sum('previous', 'costNano') ||
      sum('next', 'tokens') < sum('previous', 'tokens') ||
      pairs.some((p) => !p.previous!.success && p.next!.success))
  const accepted = usable && passed && gain
  const experiment = {
    id: randomUUID(),
    parent: s.active,
    candidate: s.candidate,
    accepted,
    pairs: pairs.length,
    createdAt: new Date().toISOString(),
    reason: !usable
      ? 'Uso incompleto, error de ejecución o configuración distinta.'
      : !passed
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
    (id !== 'v1' && !s.experiments.some((e) => e.candidate === id && e.accepted))
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
  if (task.split === 'test' && (s.candidate || (strategy === 'adaptive' && version !== s.active)))
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
      recalled: !!run.steps?.some((step) => step.role === 'memory'),
      error: run.error,
      plan: a?.plan
    }
    s.trials.push(trial)
    save()
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
      createdAt: p.createdAt
    })),
    experiments: s.experiments,
    cases: s.cases.map(({ id, source, split }) => ({ id, source, split })),
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
        .map((id) => s.cases.find((c) => c.id === id && c.split === 'dev'))
        .filter((c) => !!c)
      return {
        key: p.key,
        query: cases[0]?.prompt,
        plan: p.plan,
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
