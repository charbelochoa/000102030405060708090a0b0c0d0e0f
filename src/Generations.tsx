import { useState } from 'react'
import type { Performance, Study } from '../shared/analysis'
type Metric = 'correct' | 'tokens' | 'costNano' | 'calls' | 'latencyMs'
const units: Record<Metric, string> = {
  correct: 'Aciertos (%)',
  tokens: 'Tokens por tarea',
  costNano: 'USD por tarea',
  calls: 'Llamadas por tarea',
  latencyMs: 'Milisegundos por tarea'
}
function value(p: Performance, m: Metric) {
  if (m === 'correct') return (100 * p.correct) / p.cases
  return Number(p[m]) / (m === 'costNano' ? 1e9 : 1) / p.cases
}
const format = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 8 })
export function Generations({ experiments }: { experiments: Study['experiments'] }) {
  const [metric, setMetric] = useState<Metric>('tokens')
  const measured = experiments.flatMap((d, i) =>
    d.baseline && d.measured
      ? [{ d, g: i + 1, a: value(d.baseline, metric), b: value(d.measured, metric) }]
      : []
  )
  const top = metric === 'correct' ? 100 : Math.max(...measured.flatMap((p) => [p.a, p.b]), 0)
  const width = Math.max(430, measured.length * 106 + 118)
  const y = (n: number) => 106 - (top ? n / top : 0) * 82
  return (
    <section className="panel lab-panel generation-panel">
      <header>
        <h2>Generaciones</h2>
        <select
          aria-label="Medida por generación"
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
        >
          {Object.entries(units).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </header>
      {!measured.length ? (
        <p>Sin generaciones medidas.</p>
      ) : (
        <>
          <div className="lab-table">
            <svg
              className="generation-chart"
              viewBox={'0 0 ' + width + ' 148'}
              style={{ minWidth: width }}
              role="img"
              aria-label={units[metric] + ' en las políticas anteriores y candidatas'}
            >
              {[...new Set([0, top / 2, top])].map((t) => (
                <g key={t}>
                  <line x1="80" x2={width - 14} y1={y(t)} y2={y(t)} className="chart-grid" />
                  <text x="70" y={y(t) + 4} textAnchor="end" className="chart-label">
                    {format(t)}
                  </text>
                </g>
              ))}
              {measured.map(({ d, g, a, b }, i) => {
                const x = 92 + ((i + 0.5) * (width - 114)) / measured.length
                return (
                  <g key={d.id}>
                    <title>
                      {'G' +
                        g +
                        ' · ' +
                        (d.accepted ? 'Aceptada' : 'Rechazada') +
                        ' · ' +
                        format(a) +
                        ' → ' +
                        format(b) +
                        ' · ' +
                        d.pairs +
                        ' casos'}
                    </title>
                    <line
                      x1={x - 12}
                      x2={x + 12}
                      y1={y(a)}
                      y2={y(b)}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx={x - 12}
                      cy={y(a)}
                      r="4.5"
                      fill="var(--surface-raised)"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx={x + 12} cy={y(b)} r="4.5" fill="currentColor" />
                    <text x={x} y="133" textAnchor="middle" className="chart-label">
                      {'G' + g}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="generation-key">
            <span>○ Anterior</span>
            <span>● Candidata</span>
          </div>
          {measured.map(({ d, g, a, b }) => (
            <details key={d.id}>
              <summary>
                G{g} · {d.accepted ? 'Aceptada' : 'Rechazada'} · {format(a)} → {format(b)}
              </summary>
              <p>
                Ciclo {d.round || 1} · {d.proposal?.question} · {d.pairs} casos · {d.reason}
              </p>
              {d.proposal && (
                <p>
                  {d.proposal.operator} ·{' '}
                  {d.proposal.mode === 'adaptive' ? 'Búsqueda adaptativa' : 'Búsqueda fija'} ·{' '}
                  {d.proposal.evidence.length} experiencias · {d.proposal.history.length} decisiones
                  consultadas
                </p>
              )}
              <code>
                {d.parent} → {d.candidate}
              </code>
            </details>
          ))}
        </>
      )}
    </section>
  )
}
