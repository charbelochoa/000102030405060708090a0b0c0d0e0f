import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  FileCode2,
  Folder,
  GitBranch,
  Loader2,
  Plus,
  Save,
  Send,
  Square,
  Terminal as TerminalIcon
} from 'lucide-react'
import { money, providers } from '../shared/catalog'
import type { Run } from '../shared/types'
import { api, formatTokens, shortTime, useWorkspace } from './lib'
import { Empty, Modal, ProviderMark, SectionTitle, Status } from './components'

export function Agents({ onSelect }: { onSelect: (run: Run) => void }) {
  const { snapshot, refresh, notify } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [first, setFirst] = useState('auto')
  const [second, setSecond] = useState('auto')
  const [busy, setBusy] = useState(false)
  async function launch(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const room = `team-${Date.now().toString(36)}`
    try {
      const one = await api<Run>('/runs', {
        prompt: `${prompt}\nTu rol: construir una solución. Comparte hallazgos con el otro agente en la sala y lee sus mensajes entre iteraciones.`,
        title: prompt.slice(0, 65) + ' / constructor',
        model: first,
        reviewer: second,
        session: room
      })
      try {
        await api('/runs', {
          prompt: `${prompt}\nTu rol: encontrar errores, validar y proponer una alternativa. Coordina con el constructor en la sala ${room}.`,
          title: prompt.slice(0, 65) + ' / revisión',
          model: second,
          reviewer: first,
          session: room
        })
      } catch (e) {
        notify(`El primer agente inició; el segundo no pudo hacerlo: ${(e as Error).message}`, true)
        await refresh()
        setOpen(false)
        onSelect(one)
        return
      }
      await refresh()
      setOpen(false)
      notify(`Dos agentes lanzados. Sala: ${room}`)
    } catch (error) {
      notify((error as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <SectionTitle title="Agentes">
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={14} />
          Lanzar equipo
        </button>
      </SectionTitle>
      <div className="agents-grid">
        {snapshot?.settings.models.map((m, i) => {
          const active = snapshot.runs.filter(
            (r) => r.status === 'running' && (r.model === m.id || r.reviewer === m.id)
          )
          const config = snapshot.settings.providers.find((p) => p.id === m.provider)
          return (
            <article className="panel agent-card" key={m.id}>
              <div className="agent-card-top">
                <ProviderMark provider={m.provider} />
                <span className={`agent-state ${active.length ? 'working' : ''}`}>
                  <i />
                  {active.length ? 'Trabajando' : config?.hasKey ? 'Disponible' : 'Sin API'}
                </span>
              </div>
              <h2>{m.name}</h2>
              <p>
                {providers.find((p) => p.id === m.provider)?.name} · nivel {m.tier}
              </p>
              <div className="agent-card-cost">
                <span>
                  Entrada
                  <strong>
                    ${m.inputPrice}
                    <small> / 1 M</small>
                  </strong>
                </span>
                <span>
                  Salida
                  <strong>
                    ${m.outputPrice}
                    <small> / 1 M</small>
                  </strong>
                </span>
                <span>
                  Visión<strong>{m.vision ? 'Sí' : 'No'}</strong>
                </span>
              </div>
              {active.length > 0 && (
                <button className="agent-current" onClick={() => onSelect(active[0])}>
                  <Loader2 className="spin" size={13} />
                  {active[0].title}
                  <ArrowUpRight size={13} />
                </button>
              )}
            </article>
          )
        })}
      </div>
      <section className="panel collaboration-log">
        <div className="panel-heading">
          <div>
            <h2>Conversaciones entre agentes</h2>
          </div>
          <GitBranch size={17} />
        </div>
        {snapshot?.messages.length ? (
          snapshot.messages
            .slice(-12)
            .reverse()
            .map((m) => (
              <div className="collaboration-message" key={m.id}>
                <div>
                  <span className="mono">{m.from}</span>
                  <ArrowRight size={12} />
                  <span className="mono">{m.to}</span>
                  <span className="room-tag">{m.room}</span>
                  <time>{shortTime(m.createdAt)}</time>
                </div>
                <p>{m.text}</p>
              </div>
            ))
        ) : (
          <Empty title="Sin mensajes en la sala" />
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Dos agentes, un mismo reto"
        description="Cada agente tendrá una misión independiente y una sala compartida."
      >
        <form className="mission-form" onSubmit={launch}>
          <label>
            Objetivo
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              minLength={3}
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Constructor
              <select value={first} onChange={(e) => setFirst(e.target.value)}>
                <option value="auto">Automático</option>
                {snapshot?.settings.models
                  .filter((m) =>
                    snapshot.settings.providers.some(
                      (p) => p.id === m.provider && p.enabled && p.hasKey
                    )
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Revisor
              <select value={second} onChange={(e) => setSecond(e.target.value)}>
                <option value="auto">Automático</option>
                {snapshot?.settings.models
                  .filter((m) =>
                    snapshot.settings.providers.some(
                      (p) => p.id === m.provider && p.enabled && p.hasKey
                    )
                  )
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="form-note">
            Cada misión tiene su propio presupuesto. En modo API, ambos modelos deben estar
            conectados.
          </p>
          <div className="dialog-footer">
            <button className="button primary" disabled={busy} type="submit">
              {busy && <Loader2 className="spin" size={14} />}Lanzar equipo
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

const banner =
  '    _    _____ ____  ___ ____\n   / \\  | ____|  _ \\|_ _/ ___|\n  / _ \\ |  _| | |_) || |\\___ \\\n / ___ \\| |___|  _ < | | ___) |\n/_/   \\_\\_____|_| \\_\\___|____/'

export function TerminalView() {
  const { snapshot, refresh, notify } = useWorkspace()
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<{ type: string; text: string }[]>([])
  const [room, setRoom] = useState('general')
  const [model, setModel] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Run | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const run = snapshot?.runs.find((r) => r.id === selected?.id)
  const events = snapshot?.events.filter((e) => e.runId === run?.id) || []
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
  }, [history.length, events.length])
  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    setHistory((h) => [...h, { type: 'user', text }])
    setBusy(true)
    try {
      if (text === '/clear') {
        setHistory([])
        setSelected(null)
      } else if (text === '/help')
        setHistory((h) => [
          ...h,
          {
            type: 'system',
            text: '/help · /clear · /model ID · /room NOMBRE\n/files [ruta] · /open archivo · /config · /worktree nombre\n/message DESTINO texto · /stop\nEscribe un objetivo para iniciar una misión.'
          }
        ])
      else if (text.startsWith('/model ')) setModel(text.slice(7).trim())
      else if (text.startsWith('/room ')) setRoom(text.slice(6).trim())
      else if (text.startsWith('/files')) {
        const files = await api(`/files?path=${encodeURIComponent(text.slice(7).trim() || '.')}`)
        setHistory((h) => [
          ...h,
          {
            type: 'system',
            text: files.map((f: any) => `${f.directory ? '/' : ' '} ${f.name}`).join('\n')
          }
        ])
      } else if (text.startsWith('/open ')) {
        const file = await api(`/file?path=${encodeURIComponent(text.slice(6).trim())}`)
        setHistory((h) => [...h, { type: 'file', text: file.content }])
      } else if (text === '/config')
        setHistory((h) => [
          ...h,
          { type: 'system', text: JSON.stringify(snapshot?.settings, null, 2) }
        ])
      else if (text.startsWith('/worktree ')) {
        const result = await api('/worktrees', { name: text.slice(10).trim() })
        setHistory((h) => [...h, { type: 'system', text: `${result.branch}\n${result.path}` }])
      } else if (text.startsWith('/message ')) {
        const [, to, ...words] = text.split(' ')
        await api('/messages', { from: 'terminal-web', to, text: words.join(' '), room })
        setHistory((h) => [...h, { type: 'system', text: 'Mensaje enviado a la sala compartida.' }])
      } else if (text === '/stop' && run) await api(`/runs/${run.id}/stop`, {})
      else if (text.startsWith('/')) throw new Error('Comando desconocido. Escribe /help.')
      else {
        const result = await api<Run>('/runs', { prompt: text, model, session: room })
        setSelected(result)
      }
      await refresh()
    } catch (error) {
      setHistory((h) => [...h, { type: 'error', text: (error as Error).message }])
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <SectionTitle title="Terminal" />
      <section className="terminal-window panel">
        <div className="terminal-top">
          <span>
            <TerminalIcon size={14} />
            aeris / {room}
          </span>
          <div>
            <span className="mono">{model}</span>
          </div>
        </div>
        <div className="terminal-output">
          <pre className="ascii-banner">{banner}</pre>
          <p className="terminal-tagline">AERIS 1.0</p>
          <p className="terminal-help">
            Escribe un objetivo para empezar. /help para ver los comandos.
          </p>
          {history.map((line, i) => (
            <div className={`terminal-line ${line.type}`} key={i}>
              <span>{line.type === 'user' ? '>' : line.type === 'error' ? '!' : '·'}</span>
              <pre>{line.text}</pre>
            </div>
          ))}
          {events.map((item) => (
            <div
              key={item.id}
              className={`terminal-line ${item.type === 'error' ? 'error' : 'event'}`}
            >
              <span>
                {['thinking', 'reviewing'].includes(item.type) && run?.status === 'running' ? (
                  <Loader2 size={12} className="spin" />
                ) : (
                  '·'
                )}
              </span>
              <pre>{item.text}</pre>
              <time>{shortTime(item.createdAt)}</time>
            </div>
          ))}
          {run?.result && !['running', 'queued'].includes(run.status) && (
            <div className="terminal-result">
              <pre>{run.result}</pre>
            </div>
          )}
          <div ref={bottom} />
        </div>
        <form className="terminal-input" onSubmit={submit}>
          <span>&gt;</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="¿Qué vamos a construir?"
            aria-label="Comando u objetivo"
            autoComplete="off"
          />
          <button
            className="icon-button"
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Enviar comando"
          >
            {busy ? <Loader2 size={16} className="spin" /> : <ArrowUpRight size={18} />}
          </button>
        </form>
        <div className="terminal-status">
          <span>
            <i className="subtle-dot positive-dot" />
            {snapshot?.workspace}
          </span>
          <span>
            {run
              ? `${formatTokens(run.usage.input + run.usage.output)} tokens · ${money(run.costNano)}`
              : 'Caveman + Ponytail activos'}
          </span>
        </div>
      </section>
      <div className="terminal-hint">
        <span>En tu terminal del sistema</span>
        <code>npm run cli -- chat --name atlas --room equipo</code>
        <span>
          Abre otra terminal con <code>--name nova --room equipo</code> para compartir mensajes.
        </span>
      </div>
    </>
  )
}

export function Files() {
  const { snapshot, notify } = useWorkspace()
  const [path, setPath] = useState('.')
  const [files, setFiles] = useState<{ name: string; directory: boolean }[]>([])
  const [selected, setSelected] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [search, setSearch] = useState('')
  useEffect(() => {
    api(`/files?path=${encodeURIComponent(path)}`)
      .then(setFiles)
      .catch((e) => notify(e.message, true))
  }, [path, notify])
  async function open(name: string, directory: boolean) {
    const next = path === '.' ? name : `${path}/${name}`
    if (directory) {
      setPath(next)
      return
    }
    try {
      const result = await api(`/file?path=${encodeURIComponent(next)}`)
      setSelected(next)
      setContent(result.content)
      setDirty(false)
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  async function save() {
    try {
      await api('/file', { path: selected, content }, 'PUT')
      setDirty(false)
      notify('Archivo guardado.')
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  return (
    <>
      <SectionTitle title="Archivos" />
      <div className="file-workspace panel">
        <aside>
          <div className="file-toolbar">
            <button
              className="link-button"
              onClick={() =>
                setPath(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.')
              }
            >
              ../
            </button>
            <span title={path}>{path}</span>
          </div>
          <input
            className="file-search"
            placeholder="Filtrar archivos…"
            aria-label="Filtrar archivos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {files
            .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
            .map((f) => (
              <button
                key={f.name}
                className={`file-entry ${selected.endsWith(`/${f.name}`) || selected === f.name ? 'selected' : ''}`}
                onClick={() => void open(f.name, f.directory)}
              >
                {f.directory ? <Folder size={14} /> : <FileCode2 size={14} />}
                <span>{f.name}</span>
                {f.directory && <ChevronRight size={12} />}
              </button>
            ))}
        </aside>
        <div className="file-editor">
          {selected ? (
            <>
              <div className="editor-toolbar">
                <span>
                  <FileCode2 size={13} />
                  {selected}
                  {dirty && <i className="subtle-dot positive-dot" />}
                </span>
                <button
                  className="button small-button"
                  disabled={!dirty || !snapshot?.settings.allowWrites}
                  onClick={() => void save()}
                >
                  <Save size={12} />
                  Guardar
                </button>
              </div>
              <textarea
                spellCheck={false}
                aria-label={`Contenido de ${selected}`}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value)
                  setDirty(true)
                }}
                readOnly={!snapshot?.settings.allowWrites}
              />
              <div className="editor-footer">
                {content.split('\n').length} líneas · UTF-8 ·{' '}
                {snapshot?.settings.allowWrites
                  ? 'Edición habilitada'
                  : 'Solo lectura. Habilita la escritura en Configuración.'}
              </div>
            </>
          ) : (
            <Empty
              title="Todo tu proyecto, a mano"
              text="Selecciona un archivo para ver su contenido."
            />
          )}
        </div>
      </div>
    </>
  )
}
