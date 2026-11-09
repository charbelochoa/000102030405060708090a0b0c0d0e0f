import { createHash } from 'node:crypto'
import type {
  AnalysisPlan,
  Assessment,
  Policy,
  Procedure,
  Proposal,
  SearchMode,
  Study,
  Trial
} from '../shared/analysis'

import { teamStrategies } from '../shared/analysis'

type Option = {
  id: string
  procedures: Procedure[]
  proposal: Proposal
  weight: number
}

function programId(procedures: Procedure[]) {
  const contents = [...procedures]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => [p.key, p.team ? { team: p.team } : p.plan])
  return 'p-' + createHash('sha256').update(JSON.stringify(contents)).digest('hex').slice(0, 12)
}

export function operatorName(plan?: AnalysisPlan) {
  return plan
    ? [
        plan.aggregation,
        ...(plan.filters?.length ? ['filter'] : []),
        ...(plan.group_by ? ['group'] : [])
      ].join('/')
    : 'retire'
}

function learnedTeam(key: string, cases: Assessment[], traces: Trial[]): Procedure | undefined {
  const relevant = cases.filter((c) => c.schemaKey === key)
  const ids = new Set(relevant.map((c) => c.id))
  const calibration = traces.filter((t) => ids.has(t.taskId) && t.strategy.startsWith('team'))
  const config = calibration.at(-1)?.configuration
  if (!config) return
  const choices: { procedure: Procedure; cost: bigint; tokens: number }[] = []
  for (const strategy of teamStrategies) {
    const attempts = relevant.map((c) =>
      calibration.findLast(
        (t) => t.configuration === config && t.taskId === c.id && t.strategy === strategy
      )
    )
    if (attempts.some((t) => !t || !t.completeUsage || t.error)) return
    const completed = attempts as Trial[]
    if (!completed.every((t) => t.success && t.plan && t.team?.length === Number(strategy.at(-1))))
      continue
    const team = completed[0].team!
    if (!completed.every((t) => JSON.stringify(t.team) === JSON.stringify(team))) continue
    choices.push({
      procedure: {
        key,
        team,
        plan: completed[0].plan!,
        evidence: [...ids],
        developmentRuns: completed.map((t) => t.runId)
      },
      cost: completed.reduce((n, t) => n + BigInt(t.costNano), 0n),
      tokens: completed.reduce((n, t) => n + t.tokens, 0)
    })
  }
  return choices.sort((a, b) =>
    a.cost < b.cost
      ? -1
      : a.cost > b.cost
        ? 1
        : a.tokens - b.tokens || a.procedure.team!.length - b.procedure.team!.length
  )[0]?.procedure
}

export function selectProposal(
  dev: Assessment[],
  traces: Trial[],
  parent: Policy,
  policies: Policy[],
  decisions: Study['experiments'],
  mode: SearchMode
): Omit<Policy, 'createdAt'> | undefined {
  const groups = new Map<string, { question: string; plans: Map<string, Procedure> }>()
  for (const task of dev) {
    const group = groups.get(task.schemaKey) || {
      question: task.prompt,
      plans: new Map<string, Procedure>()
    }
    groups.set(task.schemaKey, group)
    const plans = traces
      .filter((t) => t.taskId === task.id && t.success && t.plan)
      .map((t) => t.plan!)
    if (task.plan) plans.push(task.plan)
    for (const plan of plans) {
      const serialized = JSON.stringify(plan)
      const evidence = group.plans.get(serialized) || { key: task.schemaKey, plan, evidence: [] }
      if (!evidence.evidence.includes(task.id)) evidence.evidence.push(task.id)
      group.plans.set(serialized, evidence)
    }
  }
  const tried = new Set(policies.map((p) => programId(p.procedures)))
  const options: Option[] = []
  for (const [key, group] of groups) {
    const known = parent.procedures.find((p) => p.key === key)
    const alternatives = [...group.plans.values()]
    const team = learnedTeam(key, dev, traces)
    const changes: (Procedure | undefined)[] =
      alternatives.length === 1
        ? [alternatives[0]]
        : known && alternatives.length > 1 && !known.team
          ? [undefined]
          : []
    if (team) changes.push(team)
    for (const next of changes) {
      const action = !next ? 'retire' : known ? 'replace' : 'add'
      const procedures = parent.procedures.filter((p) => p.key !== key)
      if (next) procedures.push(next)
      const behavior = programId(procedures)
      const evidence = next?.evidence || [...new Set(alternatives.flatMap((p) => p.evidence))]
      const id =
        action === 'retire'
          ? 'p-' +
            createHash('sha256')
              .update(JSON.stringify([parent.id, behavior, evidence]))
              .digest('hex')
              .slice(0, 12)
          : behavior
      if (action === 'retire' ? policies.some((p) => p.id === id) : tried.has(id)) continue
      const priorRegression = decisions.some((d) => {
        if (!d.regressions || d.proposal?.key !== key || d.proposal.action !== action) return false
        const old = policies
          .find((p) => p.id === d.candidate)
          ?.procedures.find((p) => p.key === key)
        return (
          JSON.stringify(old?.team || old?.plan) === JSON.stringify(next?.team || next?.plan) &&
          d.proposal.evidence.length === (next?.evidence.length || 0) &&
          d.proposal.evidence.every((e) => next?.evidence.includes(e))
        )
      })
      if (priorRegression) continue
      const operator = next?.team ? 'team/' + next.team.length : operatorName(next?.plan)
      const history = decisions.filter((e) => e.proposal?.operator === operator && e.measured)
      const acceptedBefore = history.filter((e) => e.accepted).length
      const rejectedBefore = history.length - acceptedBefore
      options.push({
        id,
        procedures,
        weight: (1 + acceptedBefore) / (2 + history.length),
        proposal: {
          mode,
          key,
          operator,
          question: group.question,
          action,
          acceptedBefore,
          rejectedBefore,
          evidence,
          history: []
        }
      })
    }
  }
  if (mode === 'adaptive') options.sort((a, b) => b.weight - a.weight)
  const choice = options[0]
  if (!choice) return
  if (mode === 'adaptive') {
    const operators = new Set(options.map((o) => o.proposal.operator))
    choice.proposal.history = decisions
      .filter((e) => e.proposal && e.measured && operators.has(e.proposal.operator))
      .map((e) => e.id)
  }
  return { id: choice.id, procedures: choice.procedures, proposal: choice.proposal }
}
