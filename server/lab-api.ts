import type { Express, Request } from 'express'
import { createHash } from 'node:crypto'
import { data } from './store'
import { z } from 'zod'
import { requireUser, requireAdmin } from './auth'
import { artifact, inspect, searchDocument, vehicleModels } from './analysis'
import { measuredAnalysis } from './engine'
import { fileSchema, planSchema } from '../shared/analysis'
import { chartSvg } from '../shared/chart'
import {
  caseSchema,
  addCase,
  evaluate,
  study,
  studyView,
  publishedMemory,
  propose,
  nextRound,
  decide,
  restore
} from './study'
const owner = (req: Request) => req.aerisUser!.id
const selection = z.object({ file: fileSchema, sheet: z.string().max(160).optional() })
export function registerLab(app: Express) {
  app.post('/api/lab/artifacts/:id/experience', requireAdmin, async (req, res) => {
    const who = owner(req),
      a = artifact(who, String(req.params.id))
    const run = data.runs.find(
      (r) => r.owner === who && r.id === a.runId && r.artifacts?.includes(a.id)
    )
    const file = run?.attachments.find(
      (f) => createHash('sha256').update(Buffer.from(f.data, 'base64')).digest('hex') === a.sha256
    )
    if (!file || !run) throw new Error('La traza de origen no está disponible.')
    const input = caseSchema.pick({ prompt: true, expected: true }).parse(req.body)
    res.status(201).json(
      await addCase(
        who,
        {
          ...input,
          split: 'dev',
          plan: a.plan,
          file: fileSchema.parse(file),
          sheet: a.sheet || undefined
        },
        run.id
      )
    )
  })
  app.post('/api/lab/inspect', requireUser, async (req, res) => {
    const { file, sheet } = selection.parse(req.body)
    res.json(await inspect(file, sheet))
  })
  app.post('/api/lab/search', requireUser, async (req, res) => {
    const { file, query } = selection.extend({ query: z.string().min(1).max(1000) }).parse(req.body)
    res.json(await searchDocument(owner(req), file, query))
  })
  app.post('/api/lab/analyze', requireUser, async (req, res) => {
    const input = selection
      .extend({ plan: planSchema, prompt: z.string().min(1).max(3000).default('Análisis tabular') })
      .parse(req.body)
    const run = await measuredAnalysis(
      owner(req),
      input.prompt,
      input.file,
      input.sheet,
      'static',
      'v1',
      0,
      input.plan
    )
    if (!run.artifacts?.length) throw new Error(run.error || 'Análisis interrumpido.')
    res.json(artifact(owner(req), run.artifacts[0]))
  })
  app.get('/api/lab/artifacts/:id', requireUser, (req, res) =>
    res.json(artifact(owner(req), String(req.params.id)))
  )
  app.get('/api/lab/artifacts/:id/chart.svg', requireUser, (req, res) => {
    const a = artifact(owner(req), String(req.params.id))
    const kind = z.enum(['bar', 'line']).default('bar').parse(req.query.kind)
    const offset = z.coerce.number().int().nonnegative().default(0).parse(req.query.offset)
    res
      .set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      .type('image/svg+xml')
      .send(chartSvg(a, kind, offset))
  })
  app.get('/api/lab/vehicles', requireUser, async (req, res) =>
    res.json(
      await vehicleModels(z.string().parse(req.query.make), z.coerce.number().parse(req.query.year))
    )
  )
  app.get('/api/context/procedures', requireUser, (req, res) =>
    res.json(publishedMemory(owner(req)))
  )
  app.get('/api/evolution', requireUser, (req, res) => res.json(studyView(owner(req))))
  app.post('/api/evolution/rounds', requireAdmin, (req, res) =>
    res.status(201).json(nextRound(owner(req)))
  )
  app.post('/api/evolution/cases', requireAdmin, async (req, res) =>
    res.status(201).json(await addCase(owner(req), caseSchema.parse(req.body)))
  )
  app.post('/api/optimizations', requireAdmin, (req, res) => {
    const { mode } = z
      .object({ mode: z.enum(['static', 'adaptive']).default('adaptive') })
      .parse(req.body || {})
    res.json(propose(owner(req), mode))
  })
  app.post('/api/evolution/decide', requireAdmin, (req, res) => {
    const { candidate } = z
      .object({ candidate: z.string().max(32).optional() })
      .parse(req.body || {})
    res.json(decide(owner(req), candidate))
  })
  app.post('/api/versions/:id/restore', requireAdmin, (req, res) =>
    res.json(restore(owner(req), String(req.params.id)))
  )
  app.post('/api/benchmarks', requireAdmin, async (req, res) => {
    const input = z
      .object({
        taskId: z.uuid(),
        strategy: z.enum(['fixed', 'static', 'adaptive', 'team1', 'team2', 'team3']),
        version: z.string().max(32).optional(),
        budget: z.number().positive().max(5).default(0.1)
      })
      .parse(req.body)
    res.json(
      await evaluate(
        owner(req),
        input.taskId,
        input.strategy,
        input.version || study(owner(req)).active,
        input.budget
      )
    )
  })
}
