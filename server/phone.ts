import type { Express, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireUser } from './auth'
import { data, event, message, save } from './store'
import { createRun } from './engine'
import { listPages, savePage } from './brain'
import { lessonPrefix, type PhoneConversation, type PhoneConversationView } from '../shared/phone'

const owner = (req: Request) => req.aerisUser!.id
const asyncRoute =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next)

const conversations = (): PhoneConversation[] => (data.phone ||= [])

const lessonCount = (who: string) =>
  listPages(who).filter((p) => p.enabled && p.title.startsWith(lessonPrefix)).length

const persona = (c: PhoneConversation) =>
  [
    `Eres el agente de atención al cliente de ${c.company} y respondes por un chat de teléfono con ${c.customer}.`,
    'Responde en español, con mensajes breves de una a cuatro frases, sin listas largas y sin emojis.',
    'Usa solo la información de la empresa que aparezca en el contexto recuperado y en la conversación. Si no tienes el dato, dilo y ofrece el siguiente paso en lugar de inventarlo.',
    'No uses herramientas ni archivos.',
    c.scenario ? `Situación acordada para la prueba: ${c.scenario}` : ''
  ]
    .filter(Boolean)
    .join(' ')

function view(c: PhoneConversation): PhoneConversationView {
  const runs = c.runIds
    .map((id) => data.runs.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
  const ids = new Set(c.runIds)
  const ledger = (data.usageLedger || []).filter((l) => l.owner === c.owner && ids.has(l.runId))
  return {
    ...c,
    messages: data.messages.filter((m) => m.owner === c.owner && m.room === c.room),
    turns: runs.map((r) => ({
      id: r.id,
      status: r.status,
      stopReason: r.stopReason,
      error: r.error
    })),
    pending: runs.some((r) => r.status === 'queued' || r.status === 'running'),
    usage: {
      input: ledger.reduce((n, l) => n + l.usage.input, 0),
      output: ledger.reduce((n, l) => n + l.usage.output, 0),
      calls: ledger.length,
      costNano: ledger.reduce((n, l) => n + BigInt(l.costNano), 0n).toString(),
      latencyMs: ledger.reduce((n, l) => n + l.latencyMs, 0)
    }
  }
}

function deliver(c: PhoneConversation, runId: string) {
  const timer = setInterval(() => {
    const run = data.runs.find((r) => r.id === runId)
    if (run && (run.status === 'queued' || run.status === 'running')) return
    clearInterval(timer)
    const text = run?.status === 'completed' ? run.result.trim() : ''
    if (text) message(c.owner, c.room, c.company, c.customer, text.slice(0, 4000))
    else
      event(c.owner, 'phone.failed', `Sin respuesta en la conversación con ${c.customer}.`, runId)
  }, 600)
}

const find = (req: Request) => {
  const c = conversations().find((i) => i.id === req.params.id && i.owner === owner(req))
  if (!c) throw new Error('Conversación no encontrada.')
  return c
}

export function registerPhone(app: Express) {
  app.get('/api/phone/conversations', requireUser, (req, res) =>
    res.json(
      conversations()
        .filter((c) => c.owner === owner(req))
        .map(view)
        .reverse()
    )
  )
  app.post(
    '/api/phone/conversations',
    requireUser,
    asyncRoute((req, res) => {
      const input = z
        .object({
          company: z.string().trim().min(1).max(80),
          customer: z.string().trim().min(1).max(80),
          scenario: z.string().trim().max(600).default(''),
          model: z.string().max(100).default('auto')
        })
        .parse(req.body)
      const id = randomUUID()
      const c: PhoneConversation = {
        id,
        owner: owner(req),
        room: `tel-${id}`,
        ...input,
        lessons: lessonCount(owner(req)),
        createdAt: new Date().toISOString(),
        runIds: []
      }
      conversations().push(c)
      save()
      event(c.owner, 'phone.started', `Conversación con ${c.customer} iniciada.`)
      res.status(201).json(view(c))
    })
  )
  app.post(
    '/api/phone/conversations/:id/messages',
    requireUser,
    asyncRoute((req, res) => {
      const c = find(req)
      const input = z
        .object({
          text: z.string().trim().min(1).max(1000),
          budget: z.number().finite().min(0.001).max(100).optional()
        })
        .parse(req.body)
      if (view(c).pending) throw new Error('Espera la respuesta anterior antes de enviar otra.')
      message(c.owner, c.room, c.customer, c.company, input.text)
      const run = createRun(c.owner, {
        prompt: `${persona(c)}\n\nMensaje del cliente: ${input.text}`,
        title: `Chat · ${c.customer}`.slice(0, 150),
        model: c.model,
        maxIterations: 1,
        budget: input.budget,
        session: c.room
      })
      c.runIds.push(run.id)
      save()
      deliver(c, run.id)
      res.status(202).json(view(c))
    })
  )
  app.post(
    '/api/phone/conversations/:id/rating',
    requireUser,
    asyncRoute((req, res) => {
      const c = find(req)
      const input = z
        .object({
          resolved: z.boolean(),
          score: z.number().int().min(1).max(5).optional(),
          note: z.string().trim().max(1000).default('')
        })
        .parse(req.body)
      if (view(c).pending) throw new Error('Espera a que termine la respuesta en curso.')
      c.rating = { ...input, ratedAt: new Date().toISOString() }
      if (input.note) {
        const first = data.messages.find((m) => m.owner === c.owner && m.room === c.room)
        const page = savePage(c.owner, {
          id: c.lessonPageId,
          title: `${lessonPrefix} · ${c.company} · ${c.id.slice(0, 8)}`,
          content: [
            '#atencion-cliente',
            `Situación: ${c.scenario || first?.text.slice(0, 300) || 'conversación sin descripción'}`,
            `Primer mensaje del cliente: ${first?.text.slice(0, 300) || ''}`,
            `Resultado: ${input.resolved ? 'resuelto' : 'no resuelto'}`,
            `Lección: ${input.note}`
          ].join('\n')
        })
        c.lessonPageId = page.id
      }
      save()
      event(c.owner, 'phone.rated', `Conversación con ${c.customer} calificada.`)
      res.json(view(c))
    })
  )
  app.get('/api/phone/export', requireUser, (req, res) =>
    res
      .set({
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="aeris-conversaciones.json"'
      })
      .send(
        JSON.stringify(
          conversations()
            .filter((c) => c.owner === owner(req))
            .map(view),
          null,
          2
        )
      )
  )
}
