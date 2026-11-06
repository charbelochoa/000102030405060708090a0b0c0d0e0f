import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  GitBranch,
  Layers3,
  MoreHorizontal,
  Plus,
  Radio,
  Sparkles,
  Terminal,
  TrendingUp,
  Zap
} from 'lucide-react'
import { money, providers, usd } from '../shared/catalog'
import type { Run } from '../shared/types'
import { formatTokens, shortTime, useWorkspace } from './lib'
import { Empty, ProviderMark, SectionTitle, Status, TextLink } from './components'
import { ImprovementChart, Sparkline, TokenChart } from './Charts'
import { MiniFactory } from './Factory'

export function Dashboard({
  onNew,
  onSelect,
  navigate,
  metrics = false
}: {
  onNew: () => void
  onSelect: (run: Run) => void
  navigate: (view: string) => void
  metrics?: boolean
}) {
  const { snapshot, connected } = useWorkspace()
  const [period, setPeriod] = useState('7')
  const [scope, setScope] = useState('demo')
  const [chart, setChart] = useState('quality')
  const runs = useMemo(
    () =>
      snapshot?.runs.filter(
        (r) =>
          r.mode === scope && Date.parse(r.createdAt) >= Date.now() - Number(period) * 86_400_000
      ) || [],
    [snapshot?.runs, scope, period]
  )
  const allIterations = runs.flatMap((r) => r.iterations)
  const scores = runs
    .filter((r) => r.iterations.length)
    .map((r) => Math.max(...r.iterations.map((x) => x.score)))
  const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const first = runs.filter((r) => r.iterations.length).map((r) => r.iterations[0].score)
  const delta = first.length ? score - first.reduce((a, b) => a + b, 0) / first.length : 0
  const tokens = runs.reduce((n, r) => n + r.usage.input + r.usage.output, 0)
  const cost = runs.reduce((n, r) => n + BigInt(r.costNano), 0n).toString()
  const active = snapshot?.runs.filter((r) => ['running', 'queued'].includes(r.status)) || []
  const activeRun = active[0] || runs[0]
  const events = snapshot?.events.slice(-4).reverse() || []
  const scopedLedger = (snapshot?.ledger || []).filter((l) => runs.some((r) => r.id === l.runId))
  const usedModels = [
    ...new Set(
      scope === 'live' ? scopedLedger.map((l) => l.requestedModel) : runs.map((r) => r.model)
    )
  ]
  const shownModels = [
    ...usedModels,
    ...['gpt-5.4-mini', 'claude-sonnet-5-5', 'gemini-3.1-flash-lite', 'grok-4.7'].filter(
      (id) => !usedModels.includes(id)
    )
  ].slice(0, 4)
  const perModel = (id: string) => {
    const own = runs.filter((r) => r.model === id)
    const calls = scopedLedger.filter((l) => l.requestedModel === id)
    return scope === 'live'
      ? {
          input: calls.reduce((s, l) => s + l.usage.input, 0),
          output: calls.reduce((s, l) => s + l.usage.output, 0),
          cached: calls.reduce((s, l) => s + l.usage.cached, 0),
          cost: calls.reduce((s, l) => s + BigInt(l.costNano), 0n).toString()
        }
      : {
          input: own.reduce((s, r) => s + r.usage.input, 0),
          output: own.reduce((s, r) => s + r.usage.output, 0),
          cached: own.reduce((s, r) => s + r.usage.cached, 0),
          cost: own.reduce((s, r) => s + BigInt(r.costNano), 0n).toString()
        }
  }
  return (
    <>
      <SectionTitle
        eyebrow={metrics ? 'CADA TOKEN CUENTA' : 'TU ESPACIO DE INTELIGENCIA'}
        title={metrics ? 'Todo el progreso. A la vista.' : 'El trabajo evoluciona.'}
        subtitle={
          metrics
            ? 'Calidad, consumo y decisiones de parada en un mismo lugar.'
            : 'Agentes que colaboran. Resultados que mejoran. Recursos que importan.'
        }
      >
        <button className="button" onClick={() => navigate('terminal')}>
          <Terminal size={14} />
          <span>Abrir terminal</span>
          <kbd>G T</kbd>
        </button>
        <button className="button primary" onClick={onNew}>
          <Plus size={15} />
          Nueva misión
        </button>
      </SectionTitle>
      <div className="overview-toolbar">
        <div className="tabs">
          <button className={!metrics ? 'active' : ''} onClick={() => navigate('overview')}>
            Vista general
          </button>
          <button className={metrics ? 'active' : ''} onClick={() => navigate('metrics')}>
            Rendimiento
          </button>
          <button onClick={() => navigate('factory')}>
            Vista de fábrica<span className="tiny-label">BETA</span>
          </button>
        </div>
        <div className="overview-filters">
          <span className={`live-indicator ${connected ? 'online' : ''}`}>
            <i />
            {connected ? 'Motor conectado' : 'Conectando'}
          </span>
          <select
            aria-label="Origen de las métricas"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="demo">Demostración</option>
            <option value="live">Uso real</option>
          </select>
          <select
            aria-label="Periodo de métricas"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="1">24 horas</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
          </select>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat">
          <div className="stat-title">
            Misiones en curso
            <Layers3 size={14} />
          </div>
          <div className="stat-number">
            {active
              .filter((r) => r.mode === scope)
              .length.toString()
              .padStart(2, '0')}
            <span className="stat-badge neutral">{runs.length} en el periodo</span>
          </div>
          <div className="stat-foot">
            Un objetivo, múltiples perspectivas.
            <Sparkline
              values={
                runs.length
                  ? runs
                      .slice()
                      .reverse()
                      .map((r) => Number(r.status === 'running'))
                  : [0, 0]
              }
              color="#a9a0bb"
            />
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">
            Calidad evaluada
            <TrendingUp size={14} />
          </div>
          <div className="stat-number">
            {score.toFixed(1)}
            <span className="stat-unit">/100</span>
            <span className="stat-badge">+{delta.toFixed(1)} pts</span>
          </div>
          <div className="stat-foot">
            Desde la primera iteración.
            <Sparkline
              values={allIterations.length ? allIterations.slice(0, 7).map((x) => x.score) : [0, 0]}
            />
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">
            Tokens procesados
            <Zap size={14} />
          </div>
          <div className="stat-number">
            {formatTokens(tokens)}
            <span className="stat-badge neutral">entrada + salida</span>
          </div>
          <div className="stat-foot">
            {scope === 'demo' ? 'Consumo de ejemplo.' : 'Uso reportado por las APIs.'}
            <Sparkline
              values={runs.length ? runs.map((r) => r.usage.input).reverse() : [0, 0]}
              color="#b7ae8c"
            />
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">
            {scope === 'demo' ? 'Coste simulado' : 'Coste contabilizado'}
            <span className="currency-label">USD</span>
          </div>
          <div className="stat-number">
            {money(cost, 3)}
            <span className="stat-badge neutral">
              {scope === 'demo' ? 'sin cargos' : 'tarifa configurada'}
            </span>
          </div>
          <div className="stat-foot">
            {scope === 'demo'
              ? 'Explora sin conectar tus APIs.'
              : 'Se actualiza después de cada respuesta.'}
            <Sparkline
              values={runs.length ? runs.map((r) => usd(r.costNano)).reverse() : [0, 0]}
              color="#ba957e"
            />
          </div>
        </div>
      </div>
      <div className="dashboard-middle">
        <section className="panel improvement-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="section-icon">
                <TrendingUp size={15} />
              </span>
              <div>
                <h2>Cada iteración, un poco mejor.</h2>
                <p>El progreso de tus agentes, medido.</p>
              </div>
            </div>
            <div className="segmented chart-toggle">
              <button
                className={chart === 'quality' ? 'selected' : ''}
                onClick={() => setChart('quality')}
              >
                Calidad
              </button>
              <button
                className={chart === 'tokens' ? 'selected' : ''}
                onClick={() => setChart('tokens')}
              >
                Tokens
              </button>
            </div>
          </div>
          {chart === 'quality' ? (
            <ImprovementChart runs={runs} large={metrics} />
          ) : (
            <div className="token-panel">
              <TokenChart runs={runs} />
              <div className="legend">
                <span>
                  <i className="green" />
                  Entrada
                </span>
                <span>
                  <i className="purple" />
                  Salida
                </span>
              </div>
            </div>
          )}
          <div className="panel-note">
            <span>
              <i className="subtle-dot" />
              {scope === 'demo'
                ? 'Datos de ejemplo · sin llamadas a modelos'
                : 'Evaluaciones del revisor · no equivalen a un benchmark independiente'}
            </span>
            <span>{allIterations.length} evaluaciones</span>
          </div>
        </section>
        <section className="panel mission-focus">
          <div className="panel-heading">
            <h2>En el foco</h2>
            <span className="tiny-label">{active.length ? 'EN CURSO' : 'ÚLTIMA MISIÓN'}</span>
          </div>
          {activeRun ? (
            <>
              <div className="focus-id">
                <CircleDot size={13} />
                AER-
                {activeRun.id.startsWith('demo') ? '024' : activeRun.id.slice(0, 3).toUpperCase()}
                <span>{activeRun.mode === 'demo' ? 'DEMO' : 'API'}</span>
              </div>
              <button className="focus-title" onClick={() => onSelect(activeRun)}>
                {activeRun.title}
                <ArrowUpRight size={16} />
              </button>
              <p className="focus-description">Construir. Evaluar. Aprender de cada resultado.</p>
              <div className="collaborator-stack">
                <ProviderMark provider="openai" compact />
                <ProviderMark provider="anthropic" compact />
                <span>Constructor + revisor</span>
              </div>
              <div className="focus-progress">
                <div>
                  <span>Objetivo de calidad</span>
                  <strong>
                    {activeRun.iterations.at(-1)?.score.toFixed(0) || 0}
                    <small> / {activeRun.target}</small>
                  </strong>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      transform: `scaleX(${Math.min(1, (activeRun.iterations.at(-1)?.score || 0) / activeRun.target)})`
                    }}
                  />
                </div>
              </div>
              <div className="pipeline">
                <span className="done">
                  <Check size={11} />
                  Construcción
                </span>
                <ChevronRight size={11} />
                <span className={activeRun.iterations.length ? 'done' : ''}>
                  <Check size={11} />
                  Evaluación
                </span>
                <ChevronRight size={11} />
                <span>
                  <GitBranch size={11} />
                  Iteración
                </span>
              </div>
              <button className="focus-footer" onClick={() => onSelect(activeRun)}>
                <span>
                  <Clock3 size={13} />
                  {activeRun.iterations.length} de {activeRun.maxIterations} iteraciones
                </span>
                <ArrowUpRight size={15} />
              </button>
            </>
          ) : (
            <Empty
              title="Todo comienza con un objetivo"
              text="Crea tu primera misión."
              action={
                <button className="button" onClick={onNew}>
                  Nueva misión
                </button>
              }
            />
          )}
        </section>
      </div>
      <section className="panel agent-panel">
        <div className="panel-heading">
          <div className="panel-title">
            <span className="section-icon">
              <Radio size={15} />
            </span>
            <h2>
              Tu equipo de agentes<span className="count-badge">{shownModels.length}</span>
            </h2>
          </div>
          <TextLink onClick={() => navigate('agents')}>Ver agentes</TextLink>
        </div>
        <div className="agent-table">
          <div className="agent-table-header">
            <span>AGENTE / MODELO</span>
            <span>ESPECIALIDAD</span>
            <span>ESTADO</span>
            <span>ITERACIONES</span>
            <span>CONSUMO</span>
            <span />
          </div>
          {shownModels.map((id, i) => {
            const m = snapshot?.settings.models.find((m) => m.id === id)
            if (!m) return null
            const own = runs.filter((r) => r.model === id)
            const working = active.some((r) => r.model === id)
            const p = providers.find((p) => p.id === m.provider)!
            return (
              <button className="agent-table-row" key={id} onClick={() => navigate('agents')}>
                <div className="agent-identity">
                  <ProviderMark provider={m.provider} />
                  <span>
                    <strong>
                      {['Atlas', 'Nova', 'Orion', 'Vega'][i]}
                      <span className="agent-slash">/</span>
                      <span>{m.name}</span>
                    </strong>
                    <small>{p.name}</small>
                  </span>
                </div>
                <span className="specialty">
                  {
                    [
                      'Construcción y razonamiento',
                      'Revisión y mejora',
                      'Contexto y clasificación',
                      'Análisis y exploración'
                    ][i]
                  }
                </span>
                <span className={`agent-state ${working ? 'working' : ''}`}>
                  <i />
                  {working ? 'Trabajando' : 'Disponible'}
                </span>
                <span className="mono">
                  {own
                    .reduce((n, r) => n + r.iterations.length, 0)
                    .toString()
                    .padStart(2, '0')}
                </span>
                <span className="consumption">
                  {formatTokens(perModel(id).input + perModel(id).output)}
                  <span>tokens {scope === 'demo' ? 'de ejemplo' : ''}</span>
                </span>
                <ChevronRight size={14} />
              </button>
            )
          })}
        </div>
      </section>
      <div className="dashboard-bottom">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Activity size={14} />
              <h2>Actividad reciente</h2>
            </div>
            <TextLink onClick={() => navigate('missions')}>Ver misiones</TextLink>
          </div>
          {events.map((item, i) => (
            <div className="activity-item" key={item.id}>
              <span className={`activity-node ${i === 0 ? 'latest' : ''}`}>
                {i === 0 ? <Check size={11} /> : <GitBranch size={11} />}
              </span>
              <div>
                <p>{item.text}</p>
                <span>
                  {shortTime(item.createdAt)}
                  <i />
                  {item.type === 'workspace' ? 'Espacio de trabajo' : item.type}
                </span>
              </div>
            </div>
          ))}
          {!events.length && (
            <div className="activity-item">
              <span className="activity-node">
                <Check size={11} />
              </span>
              <div>
                <p>El espacio está listo para tu siguiente misión.</p>
                <span>Crea un objetivo para empezar.</span>
              </div>
            </div>
          )}
        </section>
        <button className="factory-preview panel" onClick={() => navigate('factory')}>
          <div>
            <span className="eyebrow">INTELIGENCIA EN MOVIMIENTO</span>
            <h2>Un equipo. Un mismo lugar.</h2>
            <p>Entra a la fábrica y ve a tus agentes colaborar.</p>
            <span className="text-link">
              Explorar la fábrica
              <ArrowUpRight size={14} />
            </span>
          </div>
          <MiniFactory />
        </button>
      </div>
      <footer className="workspace-footer">
        <span>
          <AerisFooter />
          AERIS <i />
          Intelligence, in progress.
        </span>
        <span>
          {scope === 'demo' ? 'Modo de demostración' : `${runs.length} misiones con APIs`}
          <i />
          v0.1.0
        </span>
      </footer>
      {metrics && (
        <div className="panel metrics-breakdown">
          <div className="panel-heading">
            <h2>Contabilidad por modelo</h2>
            <a className="button small-button" href="/api/export" download>
              <ArrowDownToLine size={13} />
              Exportar CSV
            </a>
          </div>
          <div className="metrics-models">
            {snapshot?.settings.models
              .filter((m) => perModel(m.id).input + perModel(m.id).output > 0)
              .map((m) => {
                const own = runs.filter((r) => r.model === m.id)
                return (
                  <div key={m.id}>
                    <ProviderMark provider={m.provider} compact />
                    <strong>{m.name}</strong>
                    <span>{formatTokens(perModel(m.id).input)} entrada</span>
                    <span>{formatTokens(perModel(m.id).output)} salida</span>
                    <span>{formatTokens(perModel(m.id).cached)} caché</span>
                    <b>{money(perModel(m.id).cost, 6)}</b>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </>
  )
}

function AerisFooter() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m10 2-9 16h5l4-7 4 7h5L10 2Z" fill="currentColor" />
    </svg>
  )
}
