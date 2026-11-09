import { runCampaign } from '../shared/campaign'
import 'dotenv/config'
import { Command } from 'commander'
import chalk from 'chalk'
import { createInterface } from 'node:readline'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { Run, Snapshot } from '../shared/types'
import type { ContextCycleRecord } from '../shared/brain'
import {
  buildRsiTrace,
  renderAsciiPerformanceChart,
  renderAsciiProgressBar,
  rsiStages,
  type RsiTraceLine
} from '../shared/phone'
import { chartSvg } from '../shared/chart'
import { fileTypes } from '../shared/file-types'
import { money, providers, stopLabels } from '../shared/catalog'

const program = new Command()
  .name('aeris')
  .description('AERIS · agentes, contexto, métricas y evolución.')
  .version('1.1.0')
  .enablePositionalOptions()
const endpoint = (process.env.AERIS_URL || 'http://127.0.0.1:4318').replace(/\/$/, '')
let token = ''
try {
  token = (
    await readFile(
      join(
        resolve(
          process.env.AERIS_DATA_DIR || join(process.env.AERIS_WORKSPACE || process.cwd(), '.aeris')
        ),
        'cli-token'
      ),
      'utf8'
    )
  ).trim()
} catch {}

async function request<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST'
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${endpoint}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(150000)
    })
  } catch {
    throw new Error(
      `No se pudo conectar al motor ${endpoint}. Inicia npm run server o npm run dev.`
    )
  }
  const result = (await response.json()) as any
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
  return result
}

const print = (value: unknown): void => {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`)
}
const banner = [
  '    _    _____ ____  ___ ____',
  '   / \\  | ____|  _ \\|_ _/ ___|',
  '  / _ \\ |  _| | |_) || |\\___ \\',
  ' / ___ \\| |___|  _ < | | ___) |',
  '/_/   \\_\\_____|_| \\_\\___|____/'
].join('\n')

function renderTraceLine(line: RsiTraceLine) {
  const tag =
    line.kind === 'error'
      ? chalk.red(line.prefix)
      : line.kind === 'agent-msg'
        ? chalk.cyan(line.prefix)
        : line.kind === 'review'
          ? chalk.yellow(line.prefix)
          : line.kind === 'tool'
            ? chalk.magenta(line.prefix)
            : chalk.green(line.prefix)
  print(`  ${tag} ${line.text}`)
  if (line.detail) print(chalk.gray(`    |_ ${line.detail}`))
}

async function follow(id: string, quiet = false): Promise<Run> {
  let last = ''
  const seen = new Set<string>()
  const frames = ['|', '/', '-', '\\']
  let frame = 0
  while (true) {
    const [run, snapshot] = await Promise.all([
      request<Run>(`/runs/${id}`),
      quiet ? Promise.resolve(null) : request<Snapshot>('/snapshot').catch(() => null)
    ])
    if (!quiet && snapshot) {
      const trace = buildRsiTrace(snapshot.events, snapshot.messages, {
        runIds: [id],
        room: run.session
      })
      for (const line of trace) {
        if (seen.has(line.id)) continue
        seen.add(line.id)
        if (process.stdout.isTTY) process.stdout.write('\r\x1b[2K')
        renderTraceLine(line)
      }
    }
    const marker = `${run.status}-${run.iterations.length}`
    if (!quiet && marker !== last) {
      if (process.stdout.isTTY) process.stdout.write('\r\x1b[2K')
      const bar = renderAsciiProgressBar(
        run.iterations.length,
        Math.max(1, run.maxIterations),
        20,
        'Ciclos RSI'
      )
      print(
        chalk.gray(
          `  ${bar} · ${run.status} · ${run.usage.input + run.usage.output} tokens · ${money(run.costNano)} USD`
        )
      )
      last = marker
    }
    if (!['running', 'queued'].includes(run.status)) {
      if (!quiet) {
        print(chalk.green(`\n${stopLabels[run.stopReason || ''] || run.status}`))
        if (run.iterations.length) {
          print(
            chalk.cyan(
              '\n' +
                renderAsciiPerformanceChart(
                  run.iterations.map((it) => ({
                    cycle: it.index,
                    score: it.score,
                    tokens: it.tokens,
                    model: it.model,
                    tier: it.tier,
                    leaderDecision: it.leaderDecision
                  })),
                  7,
                  7
                )
            )
          )
        }
        if (run.result || run.error) print(run.result || run.error)
      }
      return run
    }
    if (!quiet && process.stdout.isTTY)
      process.stdout.write(
        `\r${chalk.green(frames[frame++ % frames.length])} ${chalk.gray('Ejecutando ciclo RSI y coordinando agentes…')}`
      )
    await delay(400)
  }
}

async function attach(paths: string[]) {
  const result = []
  for (const path of paths) {
    const buffer = await readFile(resolve(path))
    if (buffer.length > 5_000_000) throw new Error('Límite por archivo: 5 MB.')
    const ext = path.split('.').at(-1)?.toLowerCase() || ''
    const type = fileTypes[ext as keyof typeof fileTypes]
    if (!type) throw new Error(`Formato no admitido: ${path}`)
    result.push({ name: path.replace(/.*[\\/]/, ''), type, data: buffer.toString('base64') })
  }
  return result
}

program
  .command('status')
  .description('Estado del motor y consumo real')
  .action(async () => {
    const snapshot = await request<Snapshot>('/snapshot')
    print({
      engine: endpoint,
      workspace: snapshot.workspace,
      user: snapshot.user?.name,
      active: snapshot.runs.filter((r) => r.status === 'running').length,
      realCostUsd: money(
        snapshot.runs
          .filter((r) => r.mode === 'live')
          .reduce((s, r) => s + BigInt(r.costNano), 0n)
          .toString(),
        9
      ),
      providers: snapshot.settings.providers.map((p) => ({
        ...p,
        key: p.hasKey ? 'configured' : 'missing'
      }))
    })
  })

program
  .command('run')
  .argument('<prompt>')
  .option('--coordination <mode>', 'orchestrated o autonomous', 'orchestrated')
  .option('--model <id>', 'Modelo o auto', 'auto')
  .option('--reviewer <id>', 'Modelo revisor', 'auto')
  .option('--room <name>', 'Sala compartida', 'general')
  .option('--live', 'Usar APIs reales')
  .option('--budget <usd>', 'Límite USD', Number)
  .option('--iterations <n>', 'Máximo de iteraciones', Number)
  .option('--attach <paths...>', 'Adjuntar archivos')
  .option('--wait', 'Esperar el resultado')
  .option('--json', 'Salida estructurada')
  .action(async (prompt, options) => {
    const run = await request<Run>('/runs', {
      prompt,
      coordination: options.coordination,
      model: options.model,
      reviewer: options.reviewer,
      session: options.room,
      mode: 'live',
      ...(options.budget !== undefined ? { budget: options.budget } : {}),
      ...(options.iterations !== undefined ? { maxIterations: options.iterations } : {}),
      attachments: await attach(options.attach || [])
    })
    if (options.wait) {
      const result = await follow(run.id, options.json)
      if (options.json) print(result)
      if (result.status === 'failed') process.exitCode = 1
    } else print(options.json ? run : `Misión: ${run.id}\nSala: ${run.session}\nModo: ${run.mode}`)
  })

program
  .command('runs')
  .description('Listar misiones')
  .action(async () => {
    const s = await request<Snapshot>('/snapshot')
    print(
      s.runs.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        mode: r.mode,
        cost: money(r.costNano)
      }))
    )
  })
program
  .command('inspect')
  .argument('<id>')
  .action(async (id) => print(await request(`/runs/${id}`)))
program
  .command('stop')
  .argument('<id>')
  .action(async (id) => print(await request(`/runs/${id}/stop`, {})))
program
  .command('worktree')
  .argument('<name>')
  .action(async (name) => print(await request('/worktrees', { name })))
program
  .command('message')
  .argument('<to>')
  .argument('<text>')
  .option('--from <name>', 'Remitente', 'usuario')
  .option('--room <name>', 'Sala', 'general')
  .action(async (to, text, options) =>
    print(await request('/messages', { to, text, from: options.from, room: options.room }))
  )
program
  .command('messages')
  .option('--room <name>', 'Sala', 'general')
  .action(async (options) =>
    print(await request(`/messages?room=${encodeURIComponent(options.room)}`))
  )
program
  .command('files')
  .argument('[path]', 'Directorio', '.')
  .action(async (path) => print(await request(`/files?path=${encodeURIComponent(path)}`)))
program
  .command('read')
  .argument('<path>')
  .action(async (path) => print((await request(`/file?path=${encodeURIComponent(path)}`)).content))
program
  .command('write')
  .argument('<path>')
  .requiredOption('--from <file>', 'Archivo local con el contenido')
  .action(async (path, options) =>
    print(
      await request(
        '/file',
        { path, content: await readFile(resolve(options.from), 'utf8') },
        'PUT'
      )
    )
  )
program
  .command('search')
  .argument('<query>')
  .option('--path <path>', 'Directorio', '.')
  .action(async (query, options) =>
    print(
      await request(
        `/search?q=${encodeURIComponent(query)}&path=${encodeURIComponent(options.path)}`
      )
    )
  )
program
  .command('config')
  .description('Ver configuración sin secretos')
  .action(async () => print((await request<Snapshot>('/snapshot')).settings))
program
  .command('skills')
  .description('Ver skills disponibles')
  .action(async () => print((await request<Snapshot>('/snapshot')).skills))
program
  .command('skill-add')
  .argument('<file>')
  .option('--name <name>', 'Nombre de la skill')
  .action(async (file, options) =>
    print(
      await request('/skills', {
        name: options.name || file.replace(/.*[\\/]/, '').replace(/\.md$/, ''),
        description: 'Importada desde CLI',
        content: await readFile(resolve(file), 'utf8')
      })
    )
  )
program
  .command('models')
  .description('Modelos y logotipos ASCII')
  .action(async () => {
    const s = await request<Snapshot>('/snapshot')
    for (const p of providers) {
      print(chalk.hex(p.color)(`${p.ascii.padEnd(5)} ${p.name}`))
      for (const m of s.settings.models.filter((m) => m.provider === p.id))
        print(
          `      ${m.id.padEnd(28)} $${m.inputPrice} / $${m.outputPrice} por 1 M entrada/salida`
        )
    }
  })
program
  .command('profile')
  .argument('<file>')
  .option('--sheet <sheet>')
  .action(async (file, options) =>
    print(await request('/lab/inspect', { file: (await attach([file]))[0], sheet: options.sheet }))
  )
program
  .command('document-search')
  .argument('<file>')
  .argument('<query>')
  .action(async (file, query) =>
    print(await request('/lab/search', { file: (await attach([file]))[0], query }))
  )
program
  .command('analyze')
  .argument('<file>')
  .requiredOption('--plan <json>')
  .option('--sheet <sheet>')
  .option('--chart <html>')
  .action(async (file, options) => {
    const a = await request('/lab/analyze', {
      file: (await attach([file]))[0],
      plan: JSON.parse(await readFile(options.plan, 'utf8')),
      sheet: options.sheet
    })
    if (options.chart) {
      const pages = Array.from({ length: Math.max(1, Math.ceil(a.points.length / 32)) }, (_, i) =>
        chartSvg(a, 'bar', i * 32)
      )
      await writeFile(
        resolve(options.chart),
        '<!doctype html><html lang="es"><meta charset="utf-8"><title>AERIS</title>' +
          pages.join('') +
          '</html>',
        'utf8'
      )
    }
    print(a)
  })
program
  .command('vehicles')
  .argument('<make>')
  .argument('<year>')
  .action(async (make, year) =>
    print(
      await request(
        '/lab/vehicles?make=' + encodeURIComponent(make) + '&year=' + encodeURIComponent(year)
      )
    )
  )
program
  .command('case-import')
  .argument('<manifest>')
  .action(async (manifest) => {
    const spec = JSON.parse(await readFile(resolve(manifest), 'utf8'))
    if (typeof spec.file === 'string')
      spec.file = (await attach([resolve(dirname(resolve(manifest)), spec.file)]))[0]
    print(await request('/evolution/cases', spec))
  })
program
  .command('benchmark')
  .option('--version <id>', 'Versión, por defecto estable')
  .option('--split <split>', 'dev, validation o test', 'validation')
  .option('--task <id>')
  .option('--strategy <strategy>', 'fixed, static, adaptive, team1, team2 o team3', 'adaptive')
  .option('--budget <usd>', 'USD por caso', Number, 0.1)
  .action(async (options) => {
    const s = await request('/evolution')
    if (!['dev', 'validation', 'test'].includes(options.split))
      throw new Error('Partición desconocida.')
    const cases = s.cases.filter(
      (c: any) => c.split === options.split && (!options.task || c.id === options.task)
    )
    const trials = []
    for (const c of cases) {
      const t = await request('/benchmarks', {
        taskId: c.id,
        strategy: options.strategy,
        version: options.version || s.active,
        budget: options.budget
      })
      trials.push(t)
      if (t.error) break
    }
    print({
      versionId: options.version || s.active,
      split: options.split,
      count: trials.length,
      trials
    })
    if (trials.some((t) => t.error)) process.exitCode = 1
  })
program
  .command('promote')
  .description('Aplicar la decisión de validación')
  .action(async () => print(await request('/evolution/decide', {})))
program
  .command('optimize')
  .description('Proponer el siguiente cambio a partir del desarrollo y del historial')
  .option('--mode <mode>', 'adaptive o static', 'adaptive')
  .action(async (options) => print(await request('/optimizations', { mode: options.mode })))
program
  .command('learn')
  .option('--teams', 'Medir planificación con uno, dos y tres agentes en desarrollo')
  .option('--mode <mode>', 'adaptive o static', 'adaptive')
  .option('--generations <n>', 'Máximo de propuestas', Number, 3)
  .option('--budget <usd>', 'USD por rama', Number, 0.1)
  .option('--max-usd <usd>', 'Presupuesto de la campaña', Number, 2)
  .action(async (options) => {
    const result = await runCampaign(request, options, (message) =>
      process.stderr.write(message + '\n')
    )
    print(result)
    if (!result.decisions.length && !result.reason.startsWith('Sin cambios nuevos'))
      process.exitCode = 1
  })
program
  .command('versions')
  .description('Versiones y memoria experimental')
  .action(async () => print(await request('/evolution')))
program
  .command('next-round')
  .description('Abrir otro ciclo con la política y la experiencia acumuladas')
  .action(async () => print(await request('/evolution/rounds', {})))
program
  .command('context')
  .description('Páginas del cerebro de contexto')
  .action(async () => print(await request('/context')))
program
  .command('metrics')
  .description('Gráfica ASCII de desempeño, linealidad y bitácora RSI en terminal')
  .option('--run <id>', 'Filtrar por misión')
  .action(async (options) => {
    const [snapshot, ctx] = await Promise.all([
      request<Snapshot>('/snapshot'),
      request<{ reflections: ContextCycleRecord[]; requiredSpaces: string[] }>(
        '/context/reflections'
      )
    ])
    const reflections = options.run
      ? ctx.reflections.filter((r) => r.runId === options.run || r.runId.startsWith(options.run))
      : ctx.reflections
    const points = reflections.length
      ? reflections.map((r, i) => ({
          cycle: i + 1,
          score: r.score,
          tokens: r.tokens,
          model: r.model,
          tier: r.tier,
          leaderDecision: r.leaderDecision
        }))
      : snapshot.runs
          .filter((r) => !options.run || r.id === options.run || r.id.startsWith(options.run))
          .flatMap((r) =>
            r.iterations.map((it) => ({
              cycle: it.index,
              score: it.score,
              tokens: it.tokens,
              model: it.model || r.model,
              tier: it.tier,
              leaderDecision: it.leaderDecision
            }))
          )
    print(chalk.green(banner))
    print(
      chalk.cyan(
        '\n' + renderAsciiPerformanceChart(points, points.length ? 7 : 1, 7)
      )
    )
    if (reflections.length) {
      print(chalk.yellow('\nBitácora RSI de errores y mejoras (Cerebro de contexto):'))
      for (const r of reflections.slice(-10)) {
        print(
          `  [Ciclo ${r.cycle} · ${r.model} (${r.tier}) -> ${r.leaderDecision}] ${r.score}/100\n    Error: ${r.mistake}\n    Mejora: ${r.improvement}`
        )
      }
    }
  })
program
  .command('recall')
  .argument('<query>')
  .option('--tokens <n>', 'Presupuesto de contexto estimado', '1800')
  .action(async (query, options) =>
    print(await request('/context/retrieve', { query, maxTokens: Number(options.tokens) }))
  )
program
  .command('note-import')
  .argument('<file>')
  .option('--title <title>', 'Título de página')
  .action(async (file, options) =>
    print(
      await request('/context', {
        title: options.title || file.replace(/.*[\\/]/, '').replace(/\.md$/, ''),
        content: await readFile(resolve(file), 'utf8')
      })
    )
  )
program
  .command('restore')
  .argument('<version>')
  .action(async (id) => print(await request(`/versions/${id}/restore`, {})))
program
  .command('export')
  .option('--out <file>', 'Archivo CSV', 'aeris-metrics.csv')
  .action(async (options) => {
    const response = await fetch(`${endpoint}/api/export`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('No se pudo exportar el consumo.')
    await writeFile(resolve(options.out), await response.text())
    print(`Guardado: ${resolve(options.out)}`)
  })

program
  .command('watch')
  .description('Observar en vivo el diálogo entre agentes y las etapas del ciclo RSI')
  .option('--room <name>', 'Filtrar por sala')
  .action(async (options) => {
    print(chalk.green(banner))
    print(
      chalk.gray(
        `\nAERIS CLI · Monitor en tiempo real del ciclo RSI${options.room ? ` · sala ${options.room}` : ''}\nEtapas: ${rsiStages.map((s) => `[${s.id} ${s.short}]`).join(' -> ')}\n`
      )
    )
    const seen = new Set<string>()
    while (true) {
      try {
        const snapshot = await request<Snapshot>('/snapshot')
        const trace = buildRsiTrace(
          snapshot.events,
          snapshot.messages,
          options.room ? { room: options.room } : undefined
        )
        for (const line of trace) {
          if (seen.has(line.id)) continue
          seen.add(line.id)
          renderTraceLine(line)
        }
      } catch (e) {
        print(chalk.red((e as Error).message))
      }
      await delay(800)
    }
  })

program
  .command('chat')
  .option('--name <name>', 'Nombre del agente en la sala', 'atlas')
  .option('--room <name>', 'Sala compartida', 'general')
  .option('--model <id>', 'Modelo', 'auto')
  .option('--live', 'Usar APIs reales')
  .action(async (options) => {
    print(chalk.green(banner))
    print(
      chalk.gray(
        `\nIntelligence, in progress. v1.1.0\n${options.name} · sala ${options.room} · API\n`
      )
    )
    print(chalk.gray('/help para comandos. /exit para salir.'))
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green(`${options.name} > `)
    })
    let current: Run | null = null
    let pending = false
    let closed = false
    let lastMessage = ''
    const inbox = setInterval(async () => {
      if (closed) return
      try {
        const messages = await request<any[]>(`/messages?room=${encodeURIComponent(options.room)}`)
        const lastIndex = messages.findIndex((m) => m.id === lastMessage)
        const fresh = lastMessage ? messages.slice(lastIndex + 1) : []
        for (const m of fresh.filter((m) => m.from !== options.name))
          print(chalk.cyan(`\n[${m.from} -> ${m.to}] ${m.text}`))
        if (messages.length) lastMessage = messages.at(-1).id
        if (fresh.length) rl.prompt(true)
      } catch {}
    }, 1500)
    rl.on('line', async (input) => {
      const text = input.trim()
      try {
        if (!text) return
        if (text === '/exit') {
          rl.close()
          return
        }
        if (text === '/clear') {
          if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H')
          print(chalk.green(banner))
          return
        }
        if (text === '/help') {
          print(
            '/files [ruta] · /open ruta · /search texto · /write ruta contenido\n/worktree nombre · /config · /metrics · /model ID\n/message destino texto · /messages · /stop · /exit\nTodo otro texto inicia una misión.'
          )
          return
        }
        if (text === '/metrics') {
          const ctx = await request<{ reflections: ContextCycleRecord[] }>('/context/reflections')
          print(
            renderAsciiPerformanceChart(
              ctx.reflections.map((r, i) => ({
                cycle: i + 1,
                score: r.score,
                tokens: r.tokens,
                model: r.model,
                tier: r.tier,
                leaderDecision: r.leaderDecision
              })),
              ctx.reflections.length ? 7 : 1,
              7
            )
          )
          return
        }
        if (text.startsWith('/model ')) {
          options.model = text.slice(7).trim()
          print(`Modelo: ${options.model}`)
          return
        }
        if (text.startsWith('/message ')) {
          const [, to, ...words] = text.split(' ')
          print(
            await request('/messages', {
              room: options.room,
              from: options.name,
              to,
              text: words.join(' ')
            })
          )
          return
        }
        if (text === '/messages') {
          print(await request(`/messages?room=${encodeURIComponent(options.room)}`))
          return
        }
        if (text.startsWith('/files')) {
          print(await request(`/files?path=${encodeURIComponent(text.slice(7).trim() || '.')}`))
          return
        }
        if (text.startsWith('/open ')) {
          print((await request(`/file?path=${encodeURIComponent(text.slice(6).trim())}`)).content)
          return
        }
        if (text.startsWith('/search ')) {
          print(await request(`/search?q=${encodeURIComponent(text.slice(8).trim())}`))
          return
        }
        if (text.startsWith('/write ')) {
          const [, path, ...words] = text.split(' ')
          print(await request('/file', { path, content: words.join(' ') }, 'PUT'))
          return
        }
        if (text.startsWith('/worktree ')) {
          print(await request('/worktrees', { name: text.slice(10).trim() }))
          return
        }
        if (text === '/config') {
          print((await request<Snapshot>('/snapshot')).settings)
          return
        }
        if (text === '/stop' && current) {
          print(await request(`/runs/${current.id}/stop`, {}))
          return
        }
        if (text.startsWith('/')) throw new Error('Comando desconocido. Usa /help.')
        if (pending)
          throw new Error(
            'Hay una misión activa. Puedes enviar /message, leer archivos o usar /stop.'
          )
        pending = true
        current = await request<Run>('/runs', {
          prompt: text,
          model: options.model,
          session: options.room,
          mode: 'live'
        })
        print(chalk.gray(`Misión ${current.id}. /message sigue disponible mientras trabaja.`))
        void follow(current.id)
          .catch((e) => print(chalk.red(e.message)))
          .finally(() => {
            pending = false
            if (!closed) rl.prompt()
          })
      } catch (error) {
        print(chalk.red((error as Error).message))
      } finally {
        if (!closed) rl.prompt()
      }
    })
    rl.on('close', () => {
      closed = true
      clearInterval(inbox)
      print(chalk.gray('\nAERIS · hasta el siguiente objetivo.'))
    })
    rl.prompt()
    await new Promise<void>((done) => rl.once('close', done))
  })

try {
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${chalk.red((error as Error).message)}\n`)
  process.exitCode = 1
}
