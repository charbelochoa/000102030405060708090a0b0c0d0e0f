import { useState } from 'react'
import { Activity, ArrowDownToLine, Plus, Terminal } from 'lucide-react'
import { money } from '../shared/catalog'
import type { Run } from '../shared/types'
import { formatTokens, shortTime, useWorkspace } from './lib'
import { SectionTitle, Status, ProviderMark } from './components'
import { ImprovementChart, TokenChart } from './Charts'
import { StudioPreview } from './Factory'
import { MemoryEfficiency } from './Evolution'

export function Dashboard({
  onNew,
  onSelect,
  navigate,
  metrics = false
}: {
  onNew: () => void
  onSelect: (r: Run) => void
  navigate: (s: string) => void
  metrics?: boolean
}) {
  const { snapshot } = useWorkspace(),
    [period, setPeriod] = useState('7'),
    [chart, setChart] = useState('quality')
  const since = Date.now() - Number(period) * 86400000
  const runs = (snapshot?.runs || []).filter((r) => Date.parse(r.createdAt) >= since)
  const ledger = (snapshot?.ledger || []).filter((l) => Date.parse(l.createdAt) >= since)
  const cost = ledger.reduce((n, l) => n + BigInt(l.costNano), 0n).toString()
  const tokens = ledger.reduce((n, l) => n + l.usage.input + l.usage.output, 0)
  const models = [...new Set(ledger.map((l) => l.requestedModel))]
  const events =
    snapshot?.events
      .filter((e) => Date.parse(e.createdAt) >= since)
      .slice(-6)
      .reverse() || []
  const incomplete = runs.some((r) => r.unknownUsage)
  return (
    <>
      <SectionTitle title={metrics ? 'Métricas' : 'Vista general'}>
        <button className="button" onClick={() => navigate('terminal')}>
          <Terminal size={14} />
          Terminal
        </button>
        <button className="button primary" onClick={onNew}>
          <Plus size={14} />
          Nueva misión
        </button>
      </SectionTitle>
      {!metrics && <StudioPreview onOpen={() => navigate('factory')} />}
      <div className="overview-toolbar">
        <div className="tabs">
          <button className={!metrics ? 'active' : ''} onClick={() => navigate('overview')}>
            Vista general
          </button>
          <button className={metrics ? 'active' : ''} onClick={() => navigate('metrics')}>
            Rendimiento
          </button>
        </div>
        <select aria-label="Periodo" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="1">24 horas</option>
          <option value="7">7 días</option>
          <option value="30">30 días</option>
        </select>
      </div>
      <div className="stats-grid">
        {[
          ['Misiones', runs.length],
          ['Llamadas a modelos', ledger.length],
          [incomplete ? 'Tokens reportados · parcial' : 'Tokens reportados', formatTokens(tokens)],
          [incomplete ? 'Coste parcial USD' : 'Coste USD', money(cost, 5)]
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="stat-title">{label}</div>
            <div className="stat-number">{value}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel improvement-panel">
          <div className="panel-heading">
            <h2>Rendimiento por misión</h2>
            <div className="segmented chart-toggle">
              <button
                className={chart === 'quality' ? 'selected' : ''}
                onClick={() => setChart('quality')}
              >
                Revisor
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
          ) : ledger.length ? (
            <TokenChart runs={runs} />
          ) : (
            <p className="empty-measurement">Sin llamadas registradas.</p>
          )}
        </section>
        <section className="panel recent-panel">
          <div className="panel-heading">
            <h2>Misiones recientes</h2>
            <button className="link-button" onClick={() => navigate('missions')}>
              Ver todas
            </button>
          </div>
          {runs.slice(0, 5).map((r) => (
            <button className="focus-footer" key={r.id} onClick={() => onSelect(r)}>
              <span>{r.title}</span>
              <Status run={r} />
            </button>
          ))}
          {!runs.length && <p className="empty-measurement">Sin misiones en este periodo.</p>}
        </section>
      </div>
      {metrics && <MemoryEfficiency />}
      <section className="panel lab-panel">
        <header>
          <h2>Consumo por modelo</h2>
          <a className="button" href="/api/export" download>
            <ArrowDownToLine size={14} />
            CSV de misiones
          </a>
        </header>
        {models.length ? (
          <div className="lab-table">
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Llamadas</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>USD</th>
                </tr>
              </thead>
              <tbody>
                {models.map((id) => {
                  const calls = ledger.filter((l) => l.requestedModel === id)
                  return (
                    <tr key={id}>
                      <td>
                        <ProviderMark provider={calls[0].provider} compact /> {id}
                      </td>
                      <td>{calls.length}</td>
                      <td>{calls.reduce((a, l) => a + l.usage.input, 0)}</td>
                      <td>{calls.reduce((a, l) => a + l.usage.output, 0)}</td>
                      <td>
                        {money(calls.reduce((a, l) => a + BigInt(l.costNano), 0n).toString(), 6)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <button className="button" onClick={() => navigate('providers')}>
            Configurar APIs
          </button>
        )}
      </section>
      {!metrics && (
        <section className="panel lab-panel">
          <header>
            <h2>Actividad reciente</h2>
            <Activity size={15} />
          </header>
          {events.length ? (
            events.map((e) => (
              <div className="event-line" key={e.id}>
                <time>{shortTime(e.createdAt)}</time>
                <p>{e.text}</p>
              </div>
            ))
          ) : (
            <p>Sin actividad registrada.</p>
          )}
        </section>
      )}
    </>
  )
}
