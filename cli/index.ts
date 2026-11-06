import 'dotenv/config'
import { Command } from 'commander'
import chalk from 'chalk'
import { createInterface } from 'node:readline'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { Run, Snapshot } from '../shared/types'
import { money, providers, stopLabels } from '../shared/catalog'

const program = new Command()
  .name('aeris')
  .description('AERIS · agentes, contexto, métricas y evolución.')
  .version('0.1.0')
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
      signal: AbortSignal.timeout(15000)
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

async function follow(id: string, quiet = false): Promise<Run> {
  let last = ''
  const frames = ['|', '/', '-', '\\']
  let frame = 0
  while (true) {
    const run = await request<Run>(`/runs/${id}`)
    const marker = `${run.status}-${run.iterations.length}`
    if (!quiet && marker !== last) {
      if (process.stdout.isTTY) process.stdout.write('\r\x1b[2K')
      print(
        chalk.gray(
          `  ${run.status} · ${run.iterations.length} iteraciones · ${run.usage.input + run.usage.output} tokens · ${money(run.costNano)} ${run.mode === 'demo' ? 'simulados' : 'USD'}`
        )
      )
      last = marker
    }
    if (!['running', 'queued'].includes(run.status)) {
      if (!quiet) {
        print(chalk.green(`\n${stopLabels[run.stopReason || ''] || run.status}`))
        if (run.result) print(`\n${run.result}`)
      }
      return run
    }
    if (!quiet && process.stdout.isTTY)
      process.stdout.write(
        `\r${chalk.green(frames[frame++ % frames.length])} ${chalk.gray('Construyendo y evaluando…')}`
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
    const type = (
      {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        md: 'text/markdown',
        txt: 'text/plain',
        json: 'application/json',
        csv: 'text/csv'
      } as Record<string, string>
    )[ext]
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
      model: options.model,
      reviewer: options.reviewer,
      session: options.room,
      mode: options.live ? 'live' : 'demo',
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
  .command('benchmark')
  .option('--version <id>', 'Versión; por defecto estable')
  .option('--split <split>', 'dev, validation o test', 'validation')
  .action(async (options) => {
    const state = await request('/evolution')
    print(
      await request('/benchmarks', {
        version: options.version || state.stable,
        split: options.split
      })
    )
  })
program
  .command('optimize')
  .description('Proponer y validar una política candidata')
  .action(async () => print(await request('/optimizations', {})))
program
  .command('versions')
  .description('Versiones y memoria experimental')
  .action(async () => print(await request('/evolution')))
program
  .command('context')
  .description('Páginas del cerebro de contexto')
  .action(async () => print(await request('/context')))
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
  .command('chat')
  .option('--name <name>', 'Nombre del agente en la sala', 'atlas')
  .option('--room <name>', 'Sala compartida', 'general')
  .option('--model <id>', 'Modelo', 'auto')
  .option('--live', 'Usar APIs reales')
  .action(async (options) => {
    print(chalk.green(banner))
    print(
      chalk.gray(
        `\nIntelligence, in progress. v0.1.0\n${options.name} · sala ${options.room} · ${options.live ? 'API real' : 'demostración'}\n`
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
            '/files [ruta] · /open ruta · /search texto · /write ruta contenido\n/worktree nombre · /config · /model ID · /demo · /live\n/message destino texto · /messages · /stop · /exit\nTodo otro texto inicia una misión.'
          )
          return
        }
        if (text === '/demo' || text === '/live') {
          options.live = text === '/live'
          print(`Modo: ${options.live ? 'API real' : 'demostración'}`)
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
          mode: options.live ? 'live' : 'demo'
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
