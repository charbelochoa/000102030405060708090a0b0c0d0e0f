import { useEffect, useState } from 'react'
import { api, useWorkspace } from './lib'
import { SectionTitle } from './components'
import { money } from '../shared/catalog'
import type { Trial, Study } from '../shared/analysis'
type View = {
  active: string
  candidate?: string
  sealed: boolean
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
  const [state, setState] = useState<View>(),
    [error, setError] = useState('')
  useEffect(() => {
    api<View>('/evolution')
      .then(setState)
      .catch((e) => setError(e.message))
  }, [])
  return state ? <Efficiency state={state} /> : <p role="status">{error}</p>
}
export function Evolution() {
  const [state, setState] = useState<View>(),
    [busy, setBusy] = useState(false)
  const { notify } = useWorkspace()
  const load = async () => setState(await api('/evolution'))
  useEffect(() => {
    load().catch((e) => notify(e.message, true))
  }, [])
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
      {state && (
        <>
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
                  {c.split !== 'test' && (
                    <button
                      disabled={busy}
                      className="button"
                      onClick={async () => {
                        setBusy(true)
                        try {
                          const branches =
                            c.split === 'dev'
                              ? [['static', 'v1']]
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
                              budget: 0.1
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
                      Medir · $0.10 máx./rama
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
            {state.experiments.length ? (
              state.experiments.map((e) => (
                <div key={e.id}>
                  <code>
                    {e.parent} → {e.candidate}
                  </code>
                  <p>
                    {e.accepted ? 'Aceptada' : 'Rechazada'} · {e.reason}
                  </p>
                </div>
              ))
            ) : (
              <p>Sin decisiones de promoción.</p>
            )}
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
                        <td>{t.error || (t.success ? 'Correcto' : 'Incorrecto')}</td>
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
