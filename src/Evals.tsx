import { useCallback, useEffect, useState } from 'react'
import { curveMonotoneX, line, scaleLinear } from 'd3'
import { Activity, Play, RefreshCw } from 'lucide-react'
import { api, formatTokens, useWorkspace } from './lib'
import { SectionTitle } from './components'
import { money } from '../shared/catalog'
import type { KavakEvaluationResult, KavakScenario } from '../shared/kavak'
import type { PerformanceTrend } from '../shared/phone'

interface LoopStageStat {
  id: string
  name: string
  whatWeDo: string
  count: number
  detail: string
}

interface EvalRow {
  runId: string
  cycleOrder: number
  title: string
  prompt: string
  status: string
  coordination: string
  model: string
  tier: string
  reviewer: string
  iterationsCount: number
  score: number
  accepted: boolean
  leaderDecision: string
  mistake: string
  selfCheck: string
  tokens: number
  costNano: string
  createdAt: string
  kavakEval: KavakEvaluationResult | null
}

interface EvalsPoint {
  cycle: number
  score: number
  tokens: number
  model: string
  tier: string
  leaderDecision: string
  rmse: number
  mape: number
  f1: number
}

interface EvalsReport {
  summary: {
    totalRuns: number
    evaluatedRuns: number
    reflectionsCount: number
    lessonsCount: number
    databaseCounts: {
      vehicles: number
      orders: number
      policies: number
      scenarios: number
    }
  }
  trend: PerformanceTrend
  points: EvalsPoint[]
  loopStageCounts: LoopStageStat[]
  evalRows: EvalRow[]
  scenarios: KavakScenario[]
}

export function RsiLoopDiagram({ stages }: { stages: LoopStageStat[] }) {
  const [selectedStage, setSelectedStage] = useState<string>('06')
  const activeStage = stages.find((s) => s.id === selectedStage) || stages[0]
  const positions = [
    { x: 95, y: 72 },
    { x: 255, y: 72 },
    { x: 415, y: 72 },
    { x: 575, y: 72 },
    { x: 645, y: 185 },
    { x: 415, y: 215 },
    { x: 175, y: 215 }
  ]

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            Gráfica del Loop RSI (7 etapas en circuito cerrado)
          </h2>
          <p className="phone-note" style={{ marginTop: 4 }}>
            Haz clic en cada nodo para inspeccionar qué hace exactamente el sistema y cuántas ejecuciones acumula.
          </p>
        </div>
        <span className="mono" style={{ fontSize: 12 }}>
          01 Contexto -&gt; 05 BD Kavak -&gt; 06 Eval Estadística (RMSE/MAPE/F1) -&gt; 07 Memoria RSI -&gt; 01
        </span>
      </div>

      <svg
        viewBox="0 0 760 285"
        role="img"
        aria-label="Diagrama de circuito cerrado del Loop RSI de 7 etapas"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <marker
            id="rsi-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--tone-150)" />
          </marker>
          <marker
            id="rsi-feedback-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--tone-204)" />
          </marker>
        </defs>

        <path
          d="M 150 72 L 198 72"
          stroke="var(--tone-150)"
          strokeWidth="1.8"
          markerEnd="url(#rsi-arrow)"
        />
        <path
          d="M 310 72 L 358 72"
          stroke="var(--tone-150)"
          strokeWidth="1.8"
          markerEnd="url(#rsi-arrow)"
        />
        <path
          d="M 470 72 L 518 72"
          stroke="var(--tone-150)"
          strokeWidth="1.8"
          markerEnd="url(#rsi-arrow)"
        />
        <path
          d="M 615 104 L 645 148"
          stroke="var(--tone-150)"
          strokeWidth="1.8"
          markerEnd="url(#rsi-arrow)"
        />
        <path
          d="M 588 195 L 474 212"
          stroke="var(--tone-150)"
          strokeWidth="1.8"
          markerEnd="url(#rsi-arrow)"
        />
        <path
          d="M 358 215 L 234 215"
          stroke="var(--tone-150)"
          strokeWidth="1.8"
          markerEnd="url(#rsi-arrow)"
        />
        <path
          d="M 135 182 C 95 145, 95 125, 95 106"
          fill="none"
          stroke="var(--tone-204)"
          strokeWidth="2.2"
          strokeDasharray="4 3"
          markerEnd="url(#rsi-feedback-arrow)"
        />
        <path
          d="M 415 182 L 415 106"
          fill="none"
          stroke="var(--tone-176)"
          strokeWidth="1.6"
          strokeDasharray="3 3"
          markerEnd="url(#rsi-feedback-arrow)"
        />

        <text x="58" y="148" className="chart-label" style={{ fontSize: 10 }}>
          Lección RSI (t+1)
        </text>
        <text x="424" y="148" className="chart-label" style={{ fontSize: 10 }}>
          Escalar / Subagente
        </text>

        {stages.map((stage, idx) => {
          const pos = positions[idx] || { x: 100, y: 100 }
          const selected = stage.id === selectedStage
          return (
            <g
              key={stage.id}
              transform={`translate(${pos.x - 56}, ${pos.y - 30})`}
              onClick={() => setSelectedStage(stage.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width="112"
                height="60"
                rx="8"
                fill={selected ? 'var(--tone-32)' : 'var(--tone-20)'}
                stroke={selected ? 'var(--tone-204)' : 'var(--tone-64)'}
                strokeWidth={selected ? '2' : '1.2'}
              />
              <text
                x="10"
                y="18"
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  fill: 'var(--tone-150)',
                  fontWeight: 700
                }}
              >
                ETAPA {stage.id} · {stage.count}x
              </text>
              <text
                x="10"
                y="35"
                style={{
                  fontSize: 11,
                  fill: 'var(--tone-236)',
                  fontWeight: 600
                }}
              >
                {stage.name.slice(0, 16)}
              </text>
              <text
                x="10"
                y="50"
                style={{
                  fontSize: 9.5,
                  fill: 'var(--tone-150)'
                }}
              >
                {stage.detail.slice(0, 20)}
              </text>
            </g>
          )
        })}
      </svg>

      {activeStage && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--tone-20)',
            border: '1px solid var(--tone-48)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <div>
            <strong className="mono">
              [{activeStage.id}] {activeStage.name}:
            </strong>{' '}
            <span>{activeStage.whatWeDo}</span>
          </div>
          <span className="mono" style={{ color: 'var(--tone-176)' }}>
            {activeStage.detail} ({activeStage.count} eventos)
          </span>
        </div>
      )}
    </div>
  )
}

export function StatisticalErrorChart({
  points,
  trend
}: {
  points: EvalsPoint[]
  trend: PerformanceTrend
}) {
  if (!points.length) {
    return (
      <div className="panel" style={{ padding: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>
          Gráfica de Evals: Exactitud vs Error Estadístico (RMSE y MAPE)
        </h2>
        <p className="empty-measurement" style={{ marginTop: 12 }}>
          Ejecuta la batería de Evals de Kavak o una misión revisada para graficar la curva de mejora y la reducción del error estadístico.
        </p>
      </div>
    )
  }

  const width = 760
  const height = 250
  const count = Math.max(2, points.length)
  const x = scaleLinear()
    .domain([1, count])
    .range([46, width - 24])
  const y = scaleLinear()
    .domain([0, 100])
    .range([height - 36, 22])

  const scoreLine = line<EvalsPoint>()
    .x((_, i) => x(i + 1))
    .y((d) => y(d.score))
    .curve(curveMonotoneX)

  const rmsePctLine = line<EvalsPoint>()
    .x((_, i) => x(i + 1))
    .y((d) => y(Math.min(100, d.rmse * 100)))
    .curve(curveMonotoneX)

  const f1PctLine = line<EvalsPoint>()
    .x((_, i) => x(i + 1))
    .y((d) => y(Math.min(100, d.f1 * 100)))
    .curve(curveMonotoneX)

  const regPoints = points.map((_, i) => ({
    cycle: i + 1,
    value: Math.max(0, Math.min(100, trend.intercept + trend.slope * (i + 1)))
  }))
  const regLine = line<{ cycle: number; value: number }>()
    .x((d) => x(d.cycle))
    .y((d) => y(d.value))

  const first = points[0]
  const last = points[points.length - 1]
  const rmseDelta = first.rmse - last.rmse

  return (
    <div className="panel" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 8
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            Curva de Evals: Exactitud, F1-Score y Reducción de Error Estadístico (RMSE)
          </h2>
          <p className="phone-note" style={{ marginTop: 4 }}>
            {trend.summary}
          </p>
        </div>
        <div className="mono" style={{ fontSize: 12 }}>
          <span>
            Score: {first.score} -&gt; <strong>{last.score}/100</strong>
          </span>{' '}
          ·{' '}
          <span>
            RMSE: {first.rmse.toFixed(3)} -&gt; <strong>{last.rmse.toFixed(3)}</strong> (
            {rmseDelta >= 0 ? `-${(rmseDelta * 100).toFixed(1)} pts` : `+${(Math.abs(rmseDelta) * 100).toFixed(1)} pts`})
          </span>{' '}
          ·{' '}
          <span>
            F1: <strong>{last.f1.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gráfica multicurva de Exactitud, F1 y Error Estadístico RMSE por ciclo"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1="46" x2={width - 24} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x="36" y={y(tick) + 3} textAnchor="end" className="chart-label">
              {tick}%
            </text>
          </g>
        ))}

        {points.length > 1 && (
          <path
            d={regLine(regPoints) || ''}
            fill="none"
            stroke="var(--tone-150)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
        <path
          d={rmsePctLine(points) || ''}
          fill="none"
          stroke="#e07a5f"
          strokeWidth="2.2"
          strokeDasharray="3 2"
        />
        <path
          d={f1PctLine(points) || ''}
          fill="none"
          stroke="#81b29a"
          strokeWidth="2"
        />
        <path
          d={scoreLine(points) || ''}
          fill="none"
          stroke="var(--chart-main)"
          strokeWidth="2.8"
        />

        {points.map((p, i) => (
          <g key={p.cycle}>
            <circle cx={x(i + 1)} cy={y(p.score)} r="4" fill="var(--chart-main)" />
            <circle cx={x(i + 1)} cy={y(Math.min(100, p.rmse * 100))} r="3.5" fill="#e07a5f" />
            <circle cx={x(i + 1)} cy={y(Math.min(100, p.f1 * 100))} r="3" fill="#81b29a" />
            <text
              x={x(i + 1)}
              y={height - 12}
              textAnchor="middle"
              className="chart-label"
            >
              C{p.cycle} ({p.tier})
            </text>
          </g>
        ))}
      </svg>

      <div className="chart-bottom" style={{ marginTop: 6 }}>
        <div className="legend" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>
            <i className="series-main" /> Exactitud Eval (Score / 100)
          </span>
          <span>
            <i style={{ background: '#81b29a', display: 'inline-block', width: 10, height: 3, marginRight: 6 }} />
            F1-Score de datos exactos (%)
          </span>
          <span>
            <i style={{ background: '#e07a5f', display: 'inline-block', width: 10, height: 3, marginRight: 6 }} />
            Error Estadístico RMSE (%) — desciende al aprender
          </span>
          <span>
            <i className="series-base" /> Regresión lineal (R²={trend.rSquared.toFixed(2)})
          </span>
        </div>
        <span>CICLOS RSI</span>
      </div>
    </div>
  )
}

export function EvalsView({ embedded = false }: { embedded?: boolean }) {
  const { snapshot, notify, refresh } = useWorkspace()
  const [report, setReport] = useState<EvalsReport | null>(null)
  const [running, setRunning] = useState(false)
  const [coordination, setCoordination] = useState<'orchestrated' | 'autonomous'>('orchestrated')
  const [selectedScenarioId, setSelectedScenarioId] = useState('kavak-devolucion-vencida')
  const [customText, setCustomText] = useState('')
  const [customEval, setCustomEval] = useState<KavakEvaluationResult | null>(null)
  const lastEvent = snapshot?.events.at(-1)?.id

  const load = useCallback(async () => {
    try {
      const data = await api<EvalsReport>('/kavak/evals')
      setReport(data)
    } catch (e) {
      notify((e as Error).message, true)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load, lastEvent, snapshot?.runs.length])

  const runSuite = async () => {
    if (running) return
    setRunning(true)
    try {
      await api('/kavak/benchmark', {
        coordination,
        reviewer: 'same',
        maxIterations: 2,
        resetPrevious: true
      })
      await Promise.all([load(), refresh()])
      notify('Batería de 4 ciclos de Evals sobre datos exactos de Kavak completada.')
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setRunning(false)
    }
  }

  const testStatisticalFormula = async () => {
    if (!customText.trim()) return
    try {
      const res = await api<KavakEvaluationResult>('/kavak/evaluate', {
        scenarioId: selectedScenarioId,
        responseText: customText
      })
      setCustomEval(res)
    } catch (e) {
      notify((e as Error).message, true)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!embedded && (
        <SectionTitle title="Evals, Loop RSI y Error Estadístico">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={coordination}
              onChange={(e) => setCoordination(e.target.value as 'orchestrated' | 'autonomous')}
              aria-label="Modo de coordinación para Evals"
            >
              <option value="orchestrated">Con orquestador</option>
              <option value="autonomous">Equipo autónomo</option>
            </select>
            <button className="button" type="button" onClick={() => void load()}>
              <RefreshCw size={14} /> Actualizar
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => void runSuite()}
              disabled={running}
            >
              <Play size={14} />{' '}
              {running ? 'Ejecutando Evals…' : 'Correr Evals BD Kavak (4 ciclos)'}
            </button>
          </div>
        </SectionTitle>
      )}

      {embedded && (
        <div
          className="panel"
          style={{
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              Panel de Evals, Circuito RSI y Reducción de Error Estadístico
            </h2>
            <p className="phone-note" style={{ marginTop: 4 }}>
              Visualiza qué estamos resolviendo, cómo gira el loop de 7 etapas y cómo baja el error estadístico (RMSE / MAPE) frente a la base de datos exacta de Kavak.
            </p>
          </div>
          <button
            className="button primary"
            type="button"
            onClick={() => void runSuite()}
            disabled={running}
          >
            <Play size={14} />{' '}
            {running ? 'Ejecutando 4 ciclos…' : 'Correr Evals BD Kavak (4 ciclos)'}
          </button>
        </div>
      )}

      {report && (
        <>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-title">Ciclos evaluados (Evals)</div>
              <div className="stat-number">{report.summary.evaluatedRuns}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Pendiente lineal / R²</div>
              <div className="stat-number">
                {report.trend.slope >= 0 ? '+' : ''}
                {report.trend.slope.toFixed(1)} pts · R²={report.trend.rSquared.toFixed(2)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">RMSE / F1 último ciclo</div>
              <div className="stat-number">
                {report.points.length
                  ? `RMSE ${report.points.at(-1)!.rmse.toFixed(3)} · F1 ${report.points.at(-1)!.f1.toFixed(2)}`
                  : '—'}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">Base de datos Kavak en servidor</div>
              <div className="stat-number">
                {report.summary.databaseCounts.vehicles} autos · {report.summary.databaseCounts.orders} órdenes
              </div>
            </div>
          </div>

          <RsiLoopDiagram stages={report.loopStageCounts} />

          <StatisticalErrorChart points={report.points} trend={report.trend} />

          <section className="panel" style={{ padding: 18 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              Qué estamos resolviendo y resultados exactos de Evals por ciclo
            </h2>
            <p className="phone-note" style={{ marginTop: 4 }}>
              Cada fila compara la respuesta del agente contra los valores numéricos y políticas exactas de la base de datos del servidor: error cuadrático medio normalizado (RMSE), error porcentual absoluto medio (MAPE), desviación estándar (σ), F1-Score, dónde se equivocó y qué acción tomó el líder.
            </p>
            {report.evalRows.length ? (
              <div className="lab-table" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Ciclo</th>
                      <th>Qué resuelve (Caso / Misión)</th>
                      <th>Agente / Nivel</th>
                      <th>Score</th>
                      <th>RMSE / MAPE / σ</th>
                      <th>Precisión / Recall / F1</th>
                      <th>Residuales numéricos y diagnóstico</th>
                      <th>Decisión Líder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.evalRows.map((row) => (
                      <tr key={row.runId}>
                        <td className="mono">C{row.cycleOrder}</td>
                        <td>
                          <strong>{row.title}</strong>
                          <br />
                          <small>{row.prompt.slice(0, 110)}</small>
                        </td>
                        <td className="mono">
                          {row.model}
                          <br />
                          <span>perfil: {row.tier}</span>
                        </td>
                        <td className="mono">
                          <strong>{row.score}/100</strong>
                        </td>
                        <td className="mono">
                          {row.kavakEval ? (
                            <>
                              RMSE: {row.kavakEval.rmse.toFixed(3)}
                              <br />
                              MAPE: {row.kavakEval.mape.toFixed(1)}% · σ: {row.kavakEval.stdError.toFixed(3)}
                            </>
                          ) : (
                            'Evaluación general'
                          )}
                        </td>
                        <td className="mono">
                          {row.kavakEval ? (
                            <>
                              P={row.kavakEval.precision.toFixed(2)} · R={row.kavakEval.recall.toFixed(2)}
                              <br />
                              <strong>F1={row.kavakEval.f1.toFixed(2)}</strong>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {row.kavakEval ? (
                            <div>
                              <div>
                                <strong>Verificados ({row.kavakEval.matchedFacts.length}):</strong>{' '}
                                {row.kavakEval.matchedFacts.join(', ') || 'ninguno'}
                              </div>
                              {row.kavakEval.numericResiduals.some((r) => r.relativeError > 0) && (
                                <div style={{ color: '#e07a5f', marginTop: 2 }}>
                                  <strong>Residual &gt; 0:</strong>{' '}
                                  {row.kavakEval.numericResiduals
                                    .filter((r) => r.relativeError > 0)
                                    .map(
                                      (r) =>
                                        `${r.label}: esp=${r.expected.toLocaleString('en-US')} vs obs=${r.observed ?? 'omitido'} (e=${(r.relativeError * 100).toFixed(0)}%)`
                                    )
                                    .join(' · ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>{row.mistake || row.selfCheck}</span>
                          )}
                        </td>
                        <td className="mono">
                          {row.leaderDecision}
                          <br />
                          <small>
                            {formatTokens(row.tokens)} tok · {money(row.costNano)}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-measurement" style={{ marginTop: 12 }}>
                Aún no hay corridas evaluadas. Pulsa &quot;Correr Evals BD Kavak (4 ciclos)&quot; arriba para medir y graficar el loop completo.
              </p>
            )}
          </section>

          <section className="panel" style={{ padding: 18 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              Calculadora estadística de Evals en vivo (Prueba de residuales sobre datos exactos)
            </h2>
            <p className="phone-note" style={{ marginTop: 4 }}>
              Selecciona cualquiera de los casos de Kavak y escribe o carga una respuesta para ver cómo se calcula estadísticamente el error (RMSE, MAPE, σ, Precisión, Recall y F1) contra los valores exactos de la base de datos.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <select
                value={selectedScenarioId}
                onChange={(e) => {
                  const nextId = e.target.value
                  setSelectedScenarioId(nextId)
                  const sc = report.scenarios.find((s) => s.id === nextId)
                  if (sc) setCustomText(sc.referenceAnswer)
                }}
                aria-label="Seleccionar caso de evaluación Kavak"
              >
                {report.scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="button"
                onClick={() => {
                  const sc = report.scenarios.find((s) => s.id === selectedScenarioId)
                  if (sc) setCustomText(sc.referenceAnswer)
                }}
              >
                Cargar respuesta exacta (RMSE = 0)
              </button>
              <button
                type="button"
                className="button"
                onClick={() =>
                  setCustomText(
                    'Hola, revisé tu pedido y procede tu devolución sin costo hoy mismo en sede.'
                  )
                }
              >
                Cargar respuesta con error / omisión
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => void testStatisticalFormula()}
              >
                <Activity size={14} /> Calcular RMSE, MAPE y F1
              </button>
            </div>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              rows={3}
              placeholder="Escribe o carga una respuesta del agente para evaluar sus residuales numéricos y de política contra la base de datos Kavak…"
              style={{ width: '100%', marginTop: 10 }}
            />
            {customEval && (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--tone-20)',
                  border: '1px solid var(--tone-48)'
                }}
              >
                <div className="mono" style={{ marginBottom: 6 }}>
                  <strong>Score={customEval.score}/100</strong> · RMSE={customEval.rmse.toFixed(4)} ·
                  MAPE={customEval.mape.toFixed(2)}% · σ={customEval.stdError.toFixed(4)} · Precisión=
                  {customEval.precision.toFixed(2)} · Recall={customEval.recall.toFixed(2)} · F1=
                  {customEval.f1.toFixed(2)}
                </div>
                <p className="phone-note" style={{ margin: '4px 0' }}>
                  {customEval.statisticalFeedback}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
