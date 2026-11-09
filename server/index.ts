import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { createServer } from 'node:http'
import { resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { bus, data, event, message, publicSettings, save, setKey, workspace } from './store'
import { createRun, stopRun } from './engine'
import {
  authenticate,
  identity,
  localUser,
  login,
  logout,
  oauthCallback,
  oauthStart,
  publicUrl,
  register,
  requireAdmin,
  required,
  requireUser,
  safeUser
} from './auth'
import { listFiles, readWorkspaceFile, searchFiles, worktree, writeWorkspaceFile } from './tools'
import { defaults, providers } from '../shared/catalog'
import { registerLab } from './lab-api'
import { registerPhone } from './phone'
import { discoverModels } from './providers'
import { databaseStatus } from './realtime'
import { fileSchema } from '../shared/analysis'
import { requiredContextSpaces } from '../shared/brain'
import {
  backlinks,
  listCycleReflections,
  listPages,
  recordCycleReflection,
  retrieveContext,
  savePage
} from './brain'

const providerId = z.enum(['openai', 'anthropic', 'google', 'xai', 'deepseek', 'nvidia', 'local'])
const number = (min: number, max: number) => z.number().finite().min(min).max(max)
const modelSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9._:/-]{1,100}$/),
  name: z.string().min(1).max(100),
  provider: providerId,
  tier: z.enum(['low', 'medium', 'high', 'reasoning']),
  inputPrice: number(0, 1000),
  outputPrice: number(0, 1000),
  cachedPrice: number(0, 1000),
  cacheWritePrice: number(0, 1000),
  vision: z.boolean(),
  source: z.string().url(),
  checkedAt: z.string().max(20)
})
const newRunSchema = z.object({
  coordination: z.enum(['orchestrated', 'autonomous']).default('orchestrated'),
  prompt: z.string().trim().min(3).max(30_000),
  title: z.string().trim().min(1).max(150).optional(),
  model: z.string().max(100).optional(),
  reviewer: z.string().max(100).optional(),
  mode: z.literal('live').default('live'),
  budget: number(0.001, 100).optional(),
  maxIterations: number(1, 20).int().optional(),
  target: number(1, 100).optional(),
  session: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,60}$/)
    .optional(),
  attachments: z.array(fileSchema).max(5).optional()
})
const limited = new Map<string, { count: number; reset: number }>()
const owner = (req: Request) => req.aerisUser?.id || 'preview'
const asyncRoute =
  (fn: (req: Request, res: Response) => any) =>
  (req: Request, res: Response, next: express.NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next)

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store')
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY'
    })
    const host = req.headers.host?.split(':')[0]
    const allowedHosts = ['localhost', '127.0.0.1', new URL(publicUrl).hostname]
    if (!host || !allowedHosts.includes(host)) {
      res.status(403).json({ error: 'Host no permitido.' })
      return
    }
    const origin = req.headers.origin
    const configuredUrl = new URL(publicUrl)
    const allowedOrigins = [configuredUrl.origin, `http://${req.headers.host}`]
    const frontendOrigin =
      process.env.AERIS_FRONTEND_URL && new URL(process.env.AERIS_FRONTEND_URL).origin
    if (frontendOrigin) allowedOrigins.push(frontendOrigin)
    if (['localhost', '127.0.0.1'].includes(configuredUrl.hostname)) {
      configuredUrl.hostname = configuredUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost'
      allowedOrigins.push(configuredUrl.origin)
    }
    if (origin && !allowedOrigins.includes(origin)) {
      res.status(403).json({ error: 'Origen no permitido.' })
      return
    }
    if (origin && allowedOrigins.includes(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      })
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers['sec-fetch-site'] === 'cross-site' &&
      !(origin === frontendOrigin && req.headers.authorization?.startsWith('Bearer ')) &&
      !(
        origin === frontendOrigin &&
        ['/api/auth/login', '/api/auth/register', '/api/auth/local'].includes(req.path)
      )
    ) {
      res.status(403).json({ error: 'Solicitud externa rechazada.' })
      return
    }
    next()
  })
  app.use(express.json({ limit: '34mb' }))
  app.use(identity)
  app.use('/api', (req, res, next) => {
    if (
      process.env.AERIS_RSI_ENABLED === 'false' &&
      req.method !== 'GET' &&
      (/^\/(optimizations|evolution|benchmarks|versions)(\/|$)/.test(req.path) ||
        /\/experience$/.test(req.path))
    ) {
      res.status(403).json({
        error:
          'RSI cerrado para este servidor. No se permiten cambios de aprendizaje ni promociones.'
      })
      return
    }
    next()
  })
  app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'AERIS', version: '1.1.0' }))
  app.get('/api/snapshot', (req, res) => {
    const id = owner(req)
    res.json({
      user: req.aerisUser || null,
      runs: data.runs
        .filter((r) => r.owner === id)
        .map((r) => ({ ...r, attachments: r.attachments.map((f) => ({ ...f, data: '' })) })),
      events: data.events.filter((e) => e.owner === id).slice(-150),
      messages: data.messages.filter((m) => m.owner === id).slice(-100),
      ledger: (data.usageLedger || []).filter((l) => l.owner === id),
      settings: req.aerisUser ? publicSettings() : defaults,
      skills: req.aerisUser ? data.skills : [],
      workspace: req.aerisUser ? workspace : 'AERIS Workspace',
      auth: {
        google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        required
      },
      rsiEnabled: process.env.AERIS_RSI_ENABLED !== 'false'
    })
  })
  app.post('/api/auth/local', (req, res) => {
    if (
      required ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')
    ) {
      res.status(403).json({ error: 'El acceso local está desactivado.' })
      return
    }
    const sessionToken = login(res, localUser)
    res.json({ user: localUser, sessionToken })
  })
  app.use('/api/auth', (req, res, next) => {
    if (req.method !== 'POST') {
      next()
      return
    }
    const ip = req.socket.remoteAddress || 'local'
    let entry = limited.get(ip)
    if (!entry || entry.reset < Date.now()) {
      entry = { count: 0, reset: Date.now() + 60_000 }
      limited.set(ip, entry)
    }
    if (++entry.count > 12) {
      res.status(429).json({ error: 'Demasiados intentos. Espera un minuto.' })
      return
    }
    next()
  })
  app.post(
    '/api/auth/register',
    asyncRoute((req, res) => {
      const input = z
        .object({
          email: z.email().max(254),
          password: z.string().min(10).max(256),
          name: z.string().trim().min(2).max(80)
        })
        .parse(req.body)
      const user = register(input.email, input.password, input.name)
      const sessionToken = login(res, user)
      res.json({ user, sessionToken })
    })
  )
  app.post(
    '/api/auth/login',
    asyncRoute((req, res) => {
      const input = z
        .object({ email: z.email(), password: z.string().min(1).max(256) })
        .parse(req.body)
      const user = authenticate(input.email, input.password)
      const sessionToken = login(res, user)
      res.json({ user, sessionToken })
    })
  )
  app.post('/api/auth/logout', (req, res) => {
    logout(req, res)
    res.json({ ok: true })
  })
  app.get(
    '/api/auth/:provider/callback',
    asyncRoute((req, res) => oauthCallback(String(req.params.provider), req, res))
  )
  app.get(
    '/api/auth/:provider',
    asyncRoute((req, res) => oauthStart(String(req.params.provider), res))
  )
  app.get('/api/events', requireUser, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    })
    res.write(': connected\n\n')
    const listener = (item: any) => {
      if (item.owner === owner(req)) res.write(`id: ${item.id}\ndata: ${JSON.stringify(item)}\n\n`)
    }
    bus.on('event', listener)
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20_000)
    req.on('close', () => {
      clearInterval(heartbeat)
      bus.off('event', listener)
    })
  })
  app.post(
    '/api/runs',
    requireUser,
    asyncRoute((req, res) => {
      const input = newRunSchema.parse(req.body)
      res.status(201).json(createRun(owner(req), input))
    })
  )
  app.post(
    '/api/runs/:id/stop',
    requireUser,
    asyncRoute((req, res) => res.json(stopRun(owner(req), String(req.params.id))))
  )
  app.get('/api/runs/:id', requireUser, (req, res) => {
    const run = data.runs.find((r) => r.id === req.params.id && r.owner === owner(req))
    if (!run) {
      res.status(404).json({ error: 'Misión no encontrada.' })
      return
    }
    res.json({ ...run, attachments: run.attachments.map((f) => ({ ...f, data: '' })) })
  })
  app.get('/api/export', requireUser, (req, res) => {
    const runs = data.runs.filter((r) => r.owner === owner(req))
    const csv = [
      'id,title,mode,status,model,input_tokens,output_tokens,cached_tokens,cost_usd,stop_reason',
      ...runs.map((r) =>
        [
          r.id,
          r.title,
          r.mode,
          r.status,
          r.model,
          r.usage.input,
          r.usage.output,
          r.usage.cached,
          (Number(BigInt(r.costNano)) / 1e9).toFixed(9),
          r.stopReason || ''
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\r\n')
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="aeris-metrics.csv"'
      })
      .send(`\uFEFF${csv}`)
  })
  app.patch(
    '/api/settings',
    requireAdmin,
    asyncRoute((req, res) => {
      const schema = z
        .object({
          router: z.boolean().optional(),
          routerModel: z.string().max(100).optional(),
          optimizer: z.boolean().optional(),
          quietThreshold: number(0.1, 1).optional(),
          budget: number(0.001, 100).optional(),
          maxIterations: number(1, 20).int().optional(),
          target: number(1, 100).optional(),
          patience: number(1, 10).int().optional(),
          minDelta: number(0.1, 20).optional(),
          allowWrites: z.boolean().optional(),
          allowCommands: z.boolean().optional(),
          models: z.array(modelSchema).min(1).max(60).optional(),
          providers: z
            .array(
              z.object({
                id: providerId,
                enabled: z.boolean(),
                freeTier: z.boolean(),
                hasKey: z.boolean().optional()
              })
            )
            .length(providers.length)
            .optional()
        })
        .strict()
      const input = schema.parse(req.body)
      if (
        input.providers &&
        (new Set(input.providers.map((p) => p.id)).size !== providers.length ||
          input.providers.some((p) => p.freeTier && !['google', 'nvidia'].includes(p.id)))
      )
        throw new Error(
          'La cuota gratuita solo puede declararse para Gemini o NVIDIA y los proveedores deben ser únicos.'
        )
      if (input.models && new Set(input.models.map((m) => m.id)).size !== input.models.length)
        throw new Error('Usa identificadores de modelo únicos.')
      Object.assign(data.settings, input)
      event(owner(req), 'settings', 'Configuración actualizada.')
      res.json(publicSettings())
    })
  )
  app.put(
    '/api/providers/:id',
    requireAdmin,
    asyncRoute((req, res) => {
      const id = providerId.parse(req.params.id)
      const input = z.object({ key: z.string().trim().max(1000) }).parse(req.body)
      setKey(id, input.key)
      event(
        owner(req),
        'provider',
        `${providers.find((p) => p.id === id)!.name}: credencial ${input.key ? 'guardada' : 'eliminada'}.`
      )
      res.json(publicSettings())
    })
  )
  app.get(
    '/api/providers/:id/models',
    requireAdmin,
    asyncRoute(async (req, res) => {
      res.json(await discoverModels(providerId.parse(req.params.id)))
    })
  )
  app.get('/api/database/status', requireAdmin, (_req, res) => res.json(databaseStatus()))
  app.patch(
    '/api/skills/:id',
    requireAdmin,
    asyncRoute((req, res) => {
      const skill = data.skills.find((s) => s.id === req.params.id)
      if (!skill) {
        res.status(404).json({ error: 'Skill no encontrada.' })
        return
      }
      Object.assign(
        skill,
        z
          .object({ enabled: z.boolean().optional(), content: z.string().max(24_000).optional() })
          .strict()
          .parse(req.body)
      )
      event(owner(req), 'skill', `${skill.name}: configuración actualizada.`)
      res.json(skill)
    })
  )
  app.post(
    '/api/skills',
    requireAdmin,
    asyncRoute((req, res) => {
      const input = z
        .object({
          name: z.string().trim().min(2).max(60),
          description: z.string().max(200),
          content: z.string().min(10).max(24_000)
        })
        .parse(req.body)
      const skill = { ...input, id: randomUUID(), enabled: true, builtin: false }
      data.skills.push(skill)
      event(owner(req), 'skill', `Skill ${skill.name} añadida.`)
      res.status(201).json(skill)
    })
  )
  app.get('/api/messages', requireUser, (req, res) =>
    res.json(
      data.messages
        .filter((m) => m.owner === owner(req) && m.room === String(req.query.room || 'general'))
        .slice(-100)
    )
  )
  app.post(
    '/api/messages',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          room: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
          from: z.string().min(1).max(100),
          to: z.string().min(1).max(100),
          text: z.string().trim().min(1).max(4000)
        })
        .parse(req.body)
      res.status(201).json(message(owner(req), input.room, input.from, input.to, input.text))
    })
  )
  app.get(
    '/api/files',
    requireAdmin,
    asyncRoute(async (req, res) => res.json(await listFiles(String(req.query.path || '.'))))
  )
  app.get(
    '/api/file',
    requireAdmin,
    asyncRoute(async (req, res) =>
      res.json({ content: await readWorkspaceFile(String(req.query.path || '')) })
    )
  )
  app.put(
    '/api/file',
    requireAdmin,
    asyncRoute(async (req, res) => {
      const input = z
        .object({ path: z.string().min(1).max(500), content: z.string().max(512_000) })
        .parse(req.body)
      res.json({ result: await writeWorkspaceFile(input.path, input.content) })
    })
  )
  app.get(
    '/api/search',
    requireAdmin,
    asyncRoute(async (req, res) =>
      res.json(
        await searchFiles(
          z.string().min(1).max(100).parse(req.query.q),
          String(req.query.path || '.')
        )
      )
    )
  )
  app.post(
    '/api/worktrees',
    requireAdmin,
    asyncRoute(async (req, res) =>
      res.status(201).json(await worktree(z.object({ name: z.string() }).parse(req.body).name))
    )
  )
  registerLab(app)
  registerPhone(app)
  app.get('/api/context', requireUser, (req, res) => {
    const id = owner(req)
    res.json({
      pages: listPages(id),
      reflections: listCycleReflections(id),
      requiredSpaces: requiredContextSpaces
    })
  })
  app.get('/api/context/reflections', requireUser, (req, res) => {
    res.json({
      reflections: listCycleReflections(owner(req)),
      requiredSpaces: requiredContextSpaces
    })
  })
  app.post(
    '/api/context/reflections',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          runId: z.string().min(1).max(100),
          cycle: z.number().int().min(1).max(50),
          coordination: z.enum(['orchestrated', 'autonomous']).default('orchestrated'),
          agent: z.string().min(1).max(100),
          model: z.string().min(1).max(100),
          tier: z.enum(['low', 'medium', 'high', 'reasoning']).default('low'),
          reviewerModel: z.string().min(1).max(100),
          score: z.number().min(0).max(100),
          accepted: z.boolean().default(true),
          selfCheck: z.string().min(1).max(1000),
          mistake: z.string().min(1).max(2000),
          improvement: z.string().min(1).max(2000),
          leaderDecision: z
            .enum(['keep_small', 'escalate_model', 'spawn_subagent', 'accept'])
            .default('keep_small'),
          nextModel: z.string().max(100).optional(),
          spacesConsulted: z.array(z.string().max(160)).max(10).default([...requiredContextSpaces]),
          tokens: z.number().int().min(0).default(0),
          costNano: z.string().max(40).default('0')
        })
        .parse(req.body)
      res.status(201).json(recordCycleReflection(owner(req), input))
    })
  )
  app.post(
    '/api/context',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          id: z.string().uuid().optional(),
          title: z.string().trim().min(1).max(160),
          content: z.string().max(80_000),
          enabled: z.boolean().optional()
        })
        .strict()
        .parse(req.body)
      res.json(savePage(owner(req), input))
    })
  )
  app.get(
    '/api/context/backlinks',
    requireUser,
    asyncRoute((req, res) =>
      res.json(backlinks(owner(req), z.string().min(1).max(160).parse(req.query.title)))
    )
  )
  app.post(
    '/api/context/retrieve',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          query: z.string().min(1).max(10_000),
          maxTokens: z.number().int().min(80).max(8000).default(1800)
        })
        .parse(req.body)
      res.json(retrieveContext(owner(req), input.query, input.maxTokens))
    })
  )
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }))
  const staticDir = resolve(process.env.AERIS_STATIC_DIR || join(process.cwd(), 'dist'))
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir))
    app.get('/{*path}', (_req, res) => res.sendFile(join(staticDir, 'index.html')))
  }
  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    if (res.headersSent) return
    const validation = err instanceof z.ZodError
    res.status(validation ? 400 : 422).json({
      error: validation
        ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : (err as Error).message || 'Error inesperado.'
    })
  })
  return app
}

export async function startServer(
  port = Number(process.env.PORT || 4318),
  host = process.env.HOST || '127.0.0.1'
) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !required)
    throw new Error('Activa AERIS_AUTH_REQUIRED=true antes de abrir el servidor a la red.')
  const server = createServer(createApp())
  await new Promise<void>((done, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => done())
  })
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port
  process.stdout.write(`AERIS engine · http://${host}:${actualPort}\n`)
  return { server, port: actualPort }
}

if (process.env.AERIS_EMBEDDED !== 'true') {
  startServer().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
