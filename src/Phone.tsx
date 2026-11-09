import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Download, Loader2, Plus, Send, Terminal as TerminalIcon } from 'lucide-react'
import { api, formatTokens, shortDate, shortTime, useWorkspace } from './lib'
import { DownloadLink, Empty, SectionTitle } from './components'
import { money } from '../shared/catalog'
import type { Coordination } from '../shared/types'
import { TeamBoard } from './TeamBoard'
import {
  buildRsiTrace,
  groupByLessons,
  renderAsciiPerformanceChart,
  renderAsciiProgressBar,
  rsiStages,
  type PhoneConversationView
} from '../shared/phone'

export function Phone() {
  const { snapshot, notify } = useWorkspace()
  const [items, setItems] = useState<PhoneConversationView[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [company, setCompany] = useState('Mi empresa')
  const [customer, setCustomer] = useState('Cliente')
  const [scenario, setScenario] = useState('')
  const [model, setModel] = useState('auto')
  const [reviewer, setReviewer] = useState('auto')
  const [coordination, setCoordination] = useState<Coordination>('orchestrated')
  const [maxIterations, setMaxIterations] = useState(2)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [resolved, setResolved] = useState(true)
  const [score, setScore] = useState(5)
  const [note, setNote] = useState('')
  const screen = useRef<HTMLDivElement>(null)
  const cliBottom = useRef<HTMLDivElement>(null)
  const current = items.find((c) => c.id === selectedId)
  const lastEvent = snapshot?.events.at(-1)?.id
  const pending = items.some((c) => c.pending)

  const available = useMemo(
    () =>
      (snapshot?.settings.models || []).filter((m) =>
        snapshot?.settings.providers.some((p) => p.id === m.provider && p.enabled && p.hasKey)
      ),
    [snapshot?.settings]
  )

  const load = useCallback(async () => {
    try {
      const next = await api<PhoneConversationView[]>('/phone/conversations')
      setItems(next)
      setSelectedId((id) => (next.some((c) => c.id === id) ? id : next[0]?.id || ''))
    } catch (e) {
      notify((e as Error).message, true)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load, lastEvent])

  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => void load(), 1200)
    return () => clearInterval(timer)
  }, [pending, load])

  const chatMessages = useMemo(
    () =>
      (current?.messages || []).filter(
        (m) => m.from === current?.customer || m.from === current?.company
      ),
    [current?.messages, current?.customer, current?.company]
  )

  const trace = useMemo(() => {
    if (!current) return []
    const evs = current.events?.length ? current.events : snapshot?.events || []
    return buildRsiTrace(evs, current.messages, {
      room: current.room,
      runIds: current.runIds,
      customer: current.customer,
      company: current.company,
      coordination: current.coordination
    })
  }, [current, snapshot?.events])

  const reachedStages = useMemo(() => new Set(trace.map((t) => t.stage)), [trace])
  const activeStage = trace.at(-1)?.stage
  const perfPoints = useMemo(
    () =>
      (current?.turns || []).flatMap((t) =>
        (t.iterations || []).map((it) => ({
          cycle: it.index,
          score: it.score,
          tokens: it.tokens,
          model: it.model || t.model,
          tier: it.tier,
          leaderDecision: it.leaderDecision
        }))
      ),
    [current?.turns]
  )

  useEffect(() => {
    screen.current?.scrollTo({ top: screen.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages.length, current?.pending])

  useEffect(() => {
    cliBottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
  }, [trace.length, current?.pending])

  useEffect(() => {
    setResolved(current?.rating?.resolved ?? true)
    setScore(current?.rating?.score ?? 5)
    setNote(current?.rating?.note ?? '')
  }, [current?.id, current?.rating?.ratedAt])

  const start = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const created = await api<PhoneConversationView>('/phone/conversations', {
        company,
        customer,
        scenario,
        model,
        reviewer,
        coordination,
        maxIterations
      })
      setItems((prev) => [created, ...prev])
      setSelectedId(created.id)
    } catch (error) {
      notify((error as Error).message, true)
    }
  }

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!current || !text.trim() || sending || current.pending) return
    setSending(true)
    try {
      const updated = await api<PhoneConversationView>(
        `/phone/conversations/${current.id}/messages`,
        { text }
      )
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setText('')
    } catch (error) {
      notify((error as Error).message, true)
    } finally {
      setSending(false)
    }
  }

  const rate = async () => {
    if (!current) return
    try {
      const updated = await api<PhoneConversationView>(
        `/phone/conversations/${current.id}/rating`,
        { resolved, score, note }
      )
      setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      notify(
        note ? 'Calificación guardada y lección añadida al contexto.' : 'Calificación guardada.'
      )
    } catch (error) {
      notify((error as Error).message, true)
    }
  }

  const groups = groupByLessons(items)
  const failed = current?.turns.filter((t) => t.status === 'failed' || t.status === 'stopped')
  const failure = failed?.at(-1)

  return (
    <div className="phone-view">
      <SectionTitle title="Teléfono de clientes">
        <DownloadLink path="/phone/export" filename="aeris-conversaciones.json">
          <Download size={14} /> Exportar JSON
        </DownloadLink>
      </SectionTitle>
      <div className="phone-layout">
        <div className="phone-stage">
          <div className="phone-device" aria-label="Simulador de teléfono">
            <div className="phone-notch" />
            <header className="phone-top">
              <span className="phone-avatar">{(current?.company || company).slice(0, 1)}</span>
              <div>
                <strong>{current?.company || company}</strong>
                <small>
                  {current?.pending ? 'escribiendo…' : current ? 'en línea' : 'sin conversación'}
                </small>
              </div>
            </header>
            <div className="phone-screen" ref={screen}>
              {!current && (
                <p className="phone-hint">Inicia una conversación para escribir como cliente.</p>
              )}
              {chatMessages.map((m) => (
                <div key={m.id} className={`bubble ${m.from === current?.customer ? 'out' : 'in'}`}>
                  <span>{m.text}</span>
                  <time>{shortTime(m.createdAt)}</time>
                </div>
              ))}
              {current?.pending && (
                <div className="bubble in typing" aria-label="El agente está escribiendo">
                  <i />
                  <i />
                  <i />
                </div>
              )}
              {!current?.pending && failure && (
                <p className="phone-hint">
                  {failure.error || 'La última respuesta no se completó.'}
                </p>
              )}
            </div>
            <form className="phone-compose" onSubmit={send}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe un mensaje"
                maxLength={1000}
                disabled={!current || current.pending}
                aria-label="Mensaje del cliente"
              />
              <button
                type="submit"
                aria-label="Enviar"
                disabled={!current || current.pending || sending || !text.trim()}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
        <div className="phone-side">
          {current?.coordination === 'autonomous' && (
            <TeamBoard tasks={current.turns.at(-1)?.tasks || []} />
          )}
          <section className="terminal-window panel phone-cli" aria-label="Terminal CLI de agentes">
            <div className="terminal-top">
              <span>
                <TerminalIcon size={14} />
                aeris cli --watch {current ? `--room ${current.room}` : ''}
              </span>
              <div>
                <span className="mono">
                  {current
                    ? `constructor: ${current.model} · ${current.coordination === 'autonomous' ? 'revisor' : 'supervisor'}: ${current.reviewer || 'auto'}`
                    : 'esperando sesión'}
                </span>
              </div>
            </div>
            <div className="rsi-pipeline" aria-label="Ciclo RSI en ejecución">
              {rsiStages.map((stage) => {
                const s =
                  current?.coordination === 'autonomous'
                    ? {
                        ...stage,
                        short:
                          stage.id === '04'
                            ? 'Tablero'
                            : stage.id === '03'
                              ? 'Selección local'
                              : stage.id === '06'
                                ? 'Revisión'
                                : stage.short
                      }
                    : stage
                const done = reachedStages.has(s.id)
                const active = current?.pending && activeStage === s.id
                return (
                  <div
                    key={s.id}
                    className={`rsi-stage-pill ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                    title={s.title}
                  >
                    <span className="mono">{s.id}</span>
                    <span>{s.short}</span>
                  </div>
                )
              })}
            </div>
            <div className="terminal-output phone-cli-output">
              <p className="terminal-tagline">
                AERIS CLI · Traza multiagente y ciclo RSI en tiempo real
                <span>{current ? `${current.turns.length} turnos` : 'sin sala activa'}</span>
              </p>
              {current && (
                <div className="terminal-line stage">
                  <span>#</span>
                  <pre>
                    {renderAsciiProgressBar(reachedStages.size, 7, 24, 'Pipeline RSI')}
                  </pre>
                </div>
              )}
              {perfPoints.length > 0 && (
                <div className="terminal-line review">
                  <span>%</span>
                  <pre>
                    {renderAsciiPerformanceChart(perfPoints, reachedStages.size, 7)}
                  </pre>
                </div>
              )}
              {!trace.length && (
                <p className="terminal-help">
                  Envía un mensaje para observar el contexto recuperado, las llamadas a modelos, la
                  colaboración del equipo y sus revisiones. Elige el modo de organización al iniciar
                  una conversación.
                </p>
              )}
              {trace.map((line) => (
                <div key={line.id} className={`terminal-line ${line.kind}`}>
                  <span>
                    {line.kind === 'agent-msg'
                      ? '->'
                      : line.kind === 'review'
                        ? '*'
                        : line.kind === 'tool'
                          ? '$'
                          : line.kind === 'error'
                            ? '!'
                            : '·'}
                  </span>
                  <pre>
                    <strong className="cli-prefix">{line.prefix}</strong> {line.text}
                    {line.detail ? `\n  |_ ${line.detail}` : ''}
                  </pre>
                  <time>{shortTime(line.createdAt)}</time>
                </div>
              ))}
              {current?.pending && (
                <div className="terminal-line event">
                  <span>
                    <Loader2 size={12} className="spin" />
                  </span>
                  <pre>
                    Agentes ejecutando etapa {activeStage || '01'} del ciclo RSI en sala{' '}
                    {current.room}…
                  </pre>
                </div>
              )}
              <div ref={cliBottom} />
            </div>
            <div className="terminal-status">
              <span>
                <i className="subtle-dot positive-dot" />
                {current
                  ? `${current.lessons} lecciones en Cerebro de contexto · sala ${current.room}`
                  : 'En terminal del sistema: ./aeris.cmd watch'}
              </span>
              <span>
                {current
                  ? `${formatTokens(current.usage.input + current.usage.output)} tokens · ${current.usage.calls} llamadas · ${money(current.usage.costNano)}`
                  : 'Caveman + Ponytail + Evidence first'}
              </span>
            </div>
          </section>

          <form className="panel phone-card" onSubmit={start}>
            <h3>Nueva conversación</h3>
            <div className="phone-grid">
              <label>
                Organización del equipo
                <select
                  value={coordination}
                  onChange={(e) => setCoordination(e.target.value as Coordination)}
                >
                  <option value="orchestrated">Con orquestador</option>
                  <option value="autonomous">Equipo autónomo</option>
                </select>
              </label>
              <label>
                Empresa
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                Nombre del cliente
                <input
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
            </div>
            <label>
              Situación de la prueba
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                maxLength={600}
                rows={2}
                placeholder="Opcional. Por ejemplo: el cliente pregunta por una devolución."
              />
            </label>
            <div className="phone-grid">
              <label>
                Modelo constructor
                <select value={model} onChange={(e) => setModel(e.target.value)}>
                  <option value="auto">Automático (Router)</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Supervisor RSI (revisor)
                <select value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
                  <option value="auto">Automático (diálogo constructor + supervisor)</option>
                  <option value="same">Mismo modelo constructor (1 sola API / 1 LLM)</option>
                  <option value="none">Sin revisor (1 pasada)</option>
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Iteraciones máx. RSI
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={maxIterations}
                  onChange={(e) =>
                    setMaxIterations(Math.min(6, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </label>
            </div>
            <button className="button primary" type="submit">
              <Plus size={14} /> Iniciar
            </button>
            {!available.length && (
              <p className="phone-note">
                No hay proveedor con clave activa. Conéctalo en Proveedores y APIs para recibir
                respuestas.
              </p>
            )}
          </form>
          {current && (
            <section className="panel phone-card">
              <h3>Calificar esta conversación (Etapa 07 · Aprendizaje RSI)</h3>
              <div className="phone-metrics">
                <span>{formatTokens(current.usage.input + current.usage.output)} tokens</span>
                <span>{current.usage.calls} llamadas</span>
                <span>{money(current.usage.costNano)}</span>
                <span>{(current.usage.latencyMs / 1000).toFixed(1)} s</span>
                <span>{current.lessons} lecciones al iniciar</span>
              </div>
              <div className="phone-choice">
                <button
                  type="button"
                  className={resolved ? 'active' : ''}
                  onClick={() => setResolved(true)}
                >
                  Resuelto
                </button>
                <button
                  type="button"
                  className={!resolved ? 'active' : ''}
                  onClick={() => setResolved(false)}
                >
                  No resuelto
                </button>
              </div>
              <label>
                Calidad (1 a 5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={score}
                  onChange={(e) => setScore(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
              <label>
                Lección para el agente
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Qué debió hacer distinto. Se guarda en el Cerebro de contexto y se recupera en conversaciones parecidas."
                />
              </label>
              <button
                className="button primary"
                type="button"
                onClick={rate}
                disabled={current.pending}
              >
                Guardar calificación
              </button>
            </section>
          )}
          <section className="panel phone-card">
            <h3>Resultados medidos</h3>
            {groups.length ? (
              <table className="phone-table">
                <thead>
                  <tr>
                    <th>Lecciones</th>
                    <th>Conversaciones</th>
                    <th>Resueltas</th>
                    <th>Tokens medios</th>
                    <th>USD medio</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.lessons}>
                      <td>{g.lessons}</td>
                      <td>{g.conversations}</td>
                      <td>
                        {g.resolved} ({Math.round((g.resolved / g.conversations) * 100)}%)
                      </td>
                      <td>{formatTokens(Math.round(g.tokens / g.conversations))}</td>
                      <td>{money((BigInt(g.costNano) / BigInt(g.conversations)).toString())}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="phone-note">
                Aparecerán al calificar conversaciones. Con pocas conversaciones no hay evidencia de
                mejora.
              </p>
            )}
          </section>
          <section className="panel phone-card">
            <h3>Conversaciones</h3>
            {items.length ? (
              <ul className="phone-list">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={c.id === selectedId ? 'active' : ''}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <strong>{c.customer}</strong>
                      <span>
                        {c.company} · {shortDate(c.createdAt)} ·{' '}
                        {c.rating
                          ? c.rating.resolved
                            ? 'resuelta'
                            : 'no resuelta'
                          : 'sin calificar'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="Sin conversaciones" text="Inicia una para probar a los agentes." />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
