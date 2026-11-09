import { useEffect, useRef, useState } from 'react'
import { api, useWorkspace } from './lib'
import { SectionTitle } from './components'
import { money } from '../shared/catalog'
import type { Trial, Study } from '../shared/analysis'
import { runCampaign } from '../shared/campaign'
import { Generations } from './Generations'
import { AgentCycle } from './AgentCycle'
import type { SearchMode } from '../shared/analysis'
type View = {
  active: string
  candidate?: string
  sealed: boolean
  round: number
  cases: { id: string; source: string; split: string }[]
  policies: { id: string; procedures: number }[]
  experiments: Study['experiments']
  trials: Trial[]
}
function Efficiency({ state }: { state: View }) {
  const version = state.candidate || state.active
  const pairs = state.cases
    .filter((c) => c.split === 'validation')
    .flatMap((c) => {
      const t = state.trials.filter((t) => t.taskId === c.id),
        on = t.findLast((t) => t.version === version && t.strategy === 'adaptive' && t.recalled),
        off = t.findLast((t) => t.strategy === 'static' && t.configuration === on?.configuration)
      return on && off ? [[off, on]] : []
    })
  const partial = pairs.some((pair) => pair.some((t) => !t.completeUsage))
  return (
    <section className="panel lab-panel">
      <header>
        <h2>Eficiencia de memoria</h2>
        <span>{pairs.length} pares de validación</span>
      </header>
      {!pairs.length ? (
        <p>Sin ejecuciones emparejadas con y sin memoria.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Memoria</th>
              <th>Aciertos</th>
              <th>Tokens{partial ? ' parciales' : ''}</th>
              <th>USD{partial ? ' parciales' : ''}</th>
              <th>Latencia media</th>
            </tr>
          </thead>
          <tbody>
            {['Sin memoria', 'Con memoria'].map((label, i) => (
              <tr key={label}>
                <td>{label}</td>
                <td>
                  {pairs.filter((p) => p[i].success).length}/{pairs.length}
                </td>
                <td>{pairs.reduce((n, p) => n + p[i].tokens, 0)}</td>
                <td>
                  {money(pairs.reduce((n, p) => n + BigInt(p[i].costNano), 0n).toString(), 6)}
                </td>
                <td>
                  {Math.round(pairs.reduce((n, p) => n + p[i].latencyMs, 0) / pairs.length)} ms
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
export function MemoryEfficiency() {
  const { snapshot } = useWorkspace()
  const changed = snapshot?.events.findLast(
    (e) => e.type === 'study.measured' || e.type === 'policy.decision' || e.type === 'study.round'
  )?.id
  const [state, setState] = useState<View>(),
    [error, setError] = useState('')
  useEffect(() => {
    api<View>('/evolution')
      .then(setState)
      .catch((e) => setError(e.message))
  }, [changed])
  return state ? <Efficiency state={state} /> : <p role="status">{error}</p>
}
export function Evolution() {
  const [state, setState] = useState<View>(),
    [busy, setBusy] = useState(false)
  const { notify, snapshot } = useWorkspace()
  const [mode, setMode] = useState<SearchMode>('adaptive'),
    [generations, setGenerations] = useState(3),
    [budget, setBudget] = useState(0.1),
    [maxUsd, setMaxUsd] = useState(2),
    [teams, setTeams] = useState(false),
    [status, setStatus] = useState('')
  const campaign = useRef<AbortController | null>(null)
  const changed = snapshot?.events.findLast((e) =>
    ['policy.decision', 'memory.consolidated', 'study.measured', 'study.round'].includes(e.type)
  )?.id
  useEffect(() => () => campaign.current?.abort(), [])
  const load = async () => setState(await api('/evolution'))
  useEffect(() => {
    load().catch((e) => notify(e.message, true))
  }, [changed])
  async function act(path: string, body: unknown = {}) {
    setBusy(true)
    try {
      await api(path, body)
      await load()
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <SectionTitle title="Evolución">
        <button
          className="button"
          disabled={busy || !state?.cases.length || !!state.candidate || state.sealed}
          onClick={() => void act('/optimizations')}
        >
          Consolidar experiencias
        </button>
        {state?.sealed && (
          <button className="button" disabled={busy} onClick={() => void act('/evolution/rounds')}>
            Nuevo ciclo
          </button>
        )}
        {state?.candidate && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() => void act('/evolution/decide')}
          >
            Evaluar promoción
          </button>
        )}
      </SectionTitle>
      <AgentCycle />
      {snapshot?.rsiEnabled === false && (
        <p role="status">
          RSI cerrado en este servidor. El historial se conserva; las propuestas y promociones están
          desactivadas.
        </p>
      )}
      {state && (
        <>
          <Generations experiments={state.experiments} />
          <details className="panel lab-panel campaign-controls">
            <summary>Campaña de aprendizaje</summary>
            <div>
              <label>
                Estrategia
                <select value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
                  <option value="adaptive">Aprender de decisiones</option>
                  <option value="static">Orden fijo de control</option>
                </select>
              </label>
              <label className="campaign-check">
                <input
                  type="checkbox"
                  checked={teams}
                  onChange={(e) => setTeams(e.target.checked)}
                />
                Comparar equipos de 1, 2 y 3 agentes
              </label>
              <label>
                Generaciones
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={generations}
                  onChange={(e) => setGenerations(Number(e.target.value))}
                />
              </label>
              <label>
                USD por rama
                <input
                  type="number"
                  min="0.001"
                  max="5"
                  step="0.001"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                />
              </label>
              <label>
                USD por campaña
                <input
                  type="number"
                  min={budget}
                  step=".01"
                  value={maxUsd}
                  onChange={(e) => setMaxUsd(Number(e.target.value))}
                />
              </label>
              <button
                className="button primary"
                disabled={busy || state.sealed || !state.cases.length}
                onClick={async () => {
                  const controller = new AbortController()
                  campaign.current = controller
                  setBusy(true)
                  try {
                    const report = await runCampaign(
                      api,
                      { mode, generations, budget, maxUsd, teams },
                      setStatus,
                      controller.signal
                    )
                    setStatus(report.reason)
                    await load()
                  } catch (e) {
                    notify((e as Error).message, true)
                  } finally {
                    campaign.current = null
                    setBusy(false)
                  }
                }}
              >
                Iniciar campaña
              </button>
              {campaign.current && (
                <button className="button" onClick={() => campaign.current?.abort()}>
                  Detener al terminar la rama
                </button>
              )}
            </div>
            {status && <p role="status">{status}</p>}
          </details>
          <section className="panel lab-panel">
            <header>
              <h2>Política activa</h2>
              <code>{state.active}</code>
            </header>
            {state.policies.map((p) => (
              <div className="event-line" key={p.id}>
                <code>{p.id}</code>
                <p>{p.procedures} procedimientos verificados</p>
                {p.id !== state.active &&
                  (p.id === 'v1' ||
                    state.experiments.some((e) => e.accepted && e.candidate === p.id)) && (
                    <button
                      disabled={busy || state.sealed || !!state.candidate}
                      className="button"
                      onClick={() => void act('/versions/' + p.id + '/restore')}
                    >
                      Restaurar
                    </button>
                  )}
              </div>
            ))}
          </section>
          <Efficiency state={state} />
          <section className="panel lab-panel">
            <header>
              <h2>Casos de evaluación</h2>
              <label className="button">
                Importar JSON
                <input
                  hidden
                  type="file"
                  accept=".json"
                  disabled={busy || !!state.candidate || state.sealed}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f)
                      try {
                        await act('/evolution/cases', JSON.parse(await f.text()))
                      } catch {
                        notify('JSON inválido.', true)
                      }
                  }}
                />
              </label>
            </header>
            {state.cases.length ? (
              state.cases.map((c) => (
                <div className="event-line" key={c.id}>
                  <strong>{c.source}</strong>
                  <p>{c.split}</p>
                  {(c.split === 'test'
                    ? !state.candidate &&
                      state.experiments.some((e) => (e.round || 1) === state.round)
                    : !state.sealed) && (
                    <button
                      disabled={busy}
                      className="button"
                      onClick={async () => {
                        setBusy(true)
                        try {
                          const branches =
                            c.split === 'dev'
                              ? [['static', 'v1']]
                              : c.split === 'test'
                                ? [
                                    ['static', 'v1'],
                                    ['adaptive', state.active]
                                  ]
                                : [
                                    ['fixed', 'v1'],
                                    ['static', 'v1'],
                                    ['adaptive', state.active],
                                    ...(state.candidate ? [['adaptive', state.candidate]] : [])
                                  ]
                          for (const [strategy, version] of branches) {
                            const t = await api<Trial>('/benchmarks', {
                              taskId: c.id,
                              strategy,
                              version,
                              budget
                            })
                            if (t.error) throw new Error(t.error)
                          }
                          await load()
                        } catch (e) {
                          notify((e as Error).message, true)
                          await load()
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      {c.split === 'test' ? 'Evaluar test y sellar el ciclo' : 'Medir'} · ${budget}{' '}
                      máx./rama
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>Importa tareas con archivo y respuesta de referencia.</p>
            )}
          </section>
          <section className="panel lab-panel">
            <header>
              <h2>Experimentos</h2>
            </header>
            {state.experiments
              .filter((e) => !e.measured)
              .map((e) => (
                <div key={e.id}>
                  <code>
                    {e.parent} → {e.candidate}
                  </code>
                  <p>
                    {e.accepted ? 'Aceptada' : 'Rechazada'} · {e.reason}
                  </p>
                </div>
              ))}
            {state.trials.length > 0 && (
              <div className="lab-table">
                <table>
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Rama</th>
                      <th>Resultado</th>
                      <th>Llamadas</th>
                      <th>Tokens</th>
                      <th>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.trials.slice(-50).map((t) => (
                      <tr key={t.runId}>
                        <td>{t.taskId.slice(0, 8)}</td>
                        <td>{t.strategy}</td>
                        <td>
                          {t.error || t.invalidPlan || (t.success ? 'Correcto' : 'Incorrecto')}
                        </td>
                        <td>{t.calls}</td>
                        <td>{t.tokens}</td>
                        <td>
                          {money(t.costNano, 6)}
                          {!t.completeUsage ? ' parcial' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
