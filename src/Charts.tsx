import { useId, useState } from 'react'
import { area, curveMonotoneX, line, scaleLinear } from 'd3'
import { computePerformanceTrend } from '../shared/phone'
import type { Run } from '../shared/types'
import { formatTokens } from './lib'

export function ImprovementChart({ runs, large = false }: { runs: Run[]; large?: boolean }) {
  const id = useId().replace(/:/g, '')
  const [hovered, setHovered] = useState<number | null>(null)
  const valid = runs.filter((r) => r.iterations.length)
  if (!valid.length) return <p className="empty-measurement">Sin evaluaciones del revisor.</p>
  const count = Math.max(1, ...valid.map((r) => r.iterations.length))
  const points = Array.from({ length: count }, (_, index) => {
    const values = valid.filter((r) => r.iterations[index]).map((r) => r.iterations[index].score)
    return {
      index: index + 1,
      value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
    }
  })
  const width = 760,
    height = large ? 290 : 230
  const x = scaleLinear()
    .domain([1, count])
    .range([42, width - 18])
  const y = scaleLinear()
    .domain([0, 100])
    .range([height - 35, 20])
  const path = line<{ index: number; value: number }>()
    .x((d) => x(d.index))
    .y((d) => y(d.value))
    .curve(curveMonotoneX)
  const fill = area<{ index: number; value: number }>()
    .x((d) => x(d.index))
    .y0(height - 35)
    .y1((d) => y(d.value))
    .curve(curveMonotoneX)
  const active = hovered === null ? points.at(-1)! : points[Math.min(hovered, points.length - 1)]
  const target = valid.length ? valid.reduce((s, r) => s + r.target, 0) / valid.length : 90
  const trend = computePerformanceTrend(
    points.map((p) => ({ cycle: p.index, score: p.value }))
  )
  const regressionPoints = points.map((p) => ({
    index: p.index,
    value: Math.max(0, Math.min(100, trend.intercept + trend.slope * p.index))
  }))
  return (
    <div className="improvement-chart">
      <div className="chart-readout">
        <strong>
          {active.value.toFixed(1)}
          <span>/100</span>
        </strong>
        <span>
          {hovered === null ? 'última evaluación media' : `iteración ${active.index}`}
          {points.length > 1
            ? ` · pendiente ${trend.slope >= 0 ? '+' : ''}${trend.slope.toFixed(2)} pts/ciclo · R²=${trend.rSquared.toFixed(2)} (${trend.isLinearImprovement ? 'mejora lineal' : 'no lineal'})`
            : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Calidad media por iteración. Última evaluación: ${points.at(-1)!.value.toFixed(1)} de 100.`}
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(e) => {
          const bounds = e.currentTarget.getBoundingClientRect()
          const at = ((e.clientX - bounds.left) / bounds.width) * width
          setHovered(Math.max(0, Math.min(count - 1, Math.round(x.invert(at)) - 1)))
        }}
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--tone-176)" stopOpacity="0.17" />
            <stop offset="100%" stopColor="var(--tone-176)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line x1="42" x2={width - 18} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x="23" y={y(tick) + 3} textAnchor="end" className="chart-label">
              {tick}
            </text>
          </g>
        ))}
        <line x1="42" x2={width - 18} y1={y(target)} y2={y(target)} className="chart-target" />
        <text x={width - 20} y={y(target) - 7} textAnchor="end" className="target-label">
          objetivo {target.toFixed(0)}
        </text>
        {valid.length > 0 && (
          <>
            <path d={fill(points)!} fill={`url(#fill-${id})`} />
            <path
              d={path(points.map((p) => ({ ...p, value: points[0].value })))!}
              fill="none"
              stroke="var(--chart-base)"
              strokeWidth="1.5"
              strokeDasharray="4 5"
              opacity="0.75"
            />
            {points.length > 1 && (
              <path
                d={path(regressionPoints)!}
                fill="none"
                stroke="var(--tone-150)"
                strokeWidth="1.4"
                strokeDasharray="2 3"
                opacity="0.85"
              />
            )}
            <path d={path(points)!} fill="none" stroke="var(--chart-main)" strokeWidth="2.5" />
            <line
              x1={x(active.index)}
              x2={x(active.index)}
              y1={y(active.value)}
              y2={height - 35}
              className="chart-hover"
            />
            <circle
              cx={x(active.index)}
              cy={y(active.value)}
              r="8"
              fill="var(--chart-main)"
              opacity="0.12"
            />
            <circle
              cx={x(active.index)}
              cy={y(active.value)}
              r="3.5"
              fill="var(--chart-main)"
              stroke="var(--tone-24)"
              strokeWidth="2"
            />
          </>
        )}
        {points.map((p) => (
          <text
            key={p.index}
            x={x(p.index)}
            y={height - 11}
            textAnchor="middle"
            className="chart-label"
          >
            {String(p.index).padStart(2, '0')}
          </text>
        ))}
      </svg>
      <div className="chart-bottom">
        <div className="legend">
          <span>
            <i className="series-main" />
            Calidad evaluada (modelo)
          </span>
          <span>
            <i className="series-base" />
            Primera versión / regresión lineal
          </span>
        </div>
        <span>ITERACIÓN</span>
      </div>
    </div>
  )
}

export function Sparkline({
  values,
  color = 'var(--tone-204)'
}: {
  values: number[]
  color?: string
}) {
  const x = scaleLinear()
    .domain([0, Math.max(1, values.length - 1)])
    .range([1, 105])
  const y = scaleLinear()
    .domain([Math.min(...values) * 0.8, Math.max(...values) * 1.1 || 1])
    .range([32, 2])
  return (
    <svg className="sparkline" viewBox="0 0 108 36" aria-hidden="true">
      <path
        d={
          line<number>()
            .x((_, i) => x(i))
            .y((d) => y(d))
            .curve(curveMonotoneX)(values) || ''
        }
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export function TokenChart({ runs }: { runs: Run[] }) {
  const items = [...runs].slice(0, 12).reverse()
  const max = Math.max(1, ...items.map((r) => r.usage.input + r.usage.output))
  return (
    <div className="token-chart">
      <div className="token-chart-axis">
        <span>{formatTokens(max)}</span>
        <span>{formatTokens(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="token-bars">
        {items.map((run, i) => (
          <div
            className="token-bar"
            key={run.id}
            title={`${run.title}: ${formatTokens(run.usage.input)} entrada, ${formatTokens(run.usage.output)} salida`}
          >
            <div style={{ height: `${((run.usage.input + run.usage.output) / max) * 100}%` }}>
              <i
                style={{
                  height: `${(run.usage.output / Math.max(1, run.usage.input + run.usage.output)) * 100}%`
                }}
              />
            </div>
            <span>{String(i + 1).padStart(2, '0')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
