import type { AnalysisArtifact } from './analysis'

const xml = (v: string) =>
  v.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!
  )
export function chartSvg(a: AnalysisArtifact, kind: 'bar' | 'line' = 'bar', offset = 0) {
  const points = a.points.slice(offset, offset + 32),
    width = 720,
    height = 300
  const values = points.map((p) => Number(p.value))
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values)
  const y = (n: number) => 218 - ((n - min) / (max - min || 1)) * 177
  const dx = 600 / Math.max(1, points.length),
    x = (i: number) => 68 + dx * (i + 0.5)
  const line =
    kind === 'line'
      ? '<polyline fill="none" stroke="currentColor" points="' +
        values.map((n, i) => x(i) + ',' + y(n)).join(' ') +
        '"/>'
      : ''
  const shapes = points
    .map((p, i) => {
      const v = values[i],
        value = xml(p.value),
        label = xml(p.label)
      const shape =
        kind === 'line'
          ? '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="4"/>'
          : '<rect x="' +
            (x(i) - dx * 0.32) +
            '" y="' +
            Math.min(y(v), y(0)) +
            '" width="' +
            dx * 0.64 +
            '" height="' +
            Math.max(1, Math.abs(y(v) - y(0))) +
            '"/>'
      return (
        '<g tabindex="0"><title>' +
        label +
        ' · ' +
        value +
        '</title>' +
        shape +
        '</g>' +
        (i % Math.max(1, Math.ceil(points.length / 7)) === 0
          ? '<text x="' +
            x(i) +
            '" y="246" text-anchor="middle">' +
            xml(p.label.slice(0, 12)) +
            '</text>'
          : '')
      )
    })
    .join('')
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '" role="img" aria-label="' +
    xml(a.source) +
    '" style="background:#fff;color:#222;font:12px system-ui" fill="currentColor"><title>' +
    xml(a.source) +
    '</title><text x="18" y="22">' +
    xml(a.source) +
    ' · ' +
    xml(a.plan.aggregation) +
    ' ' +
    xml(a.plan.metric || '') +
    '</text><path stroke="#999" d="M62 ' +
    y(0) +
    'h610"/><text x="8" y="48">' +
    max.toPrecision(3) +
    '</text><text x="8" y="218">' +
    min.toPrecision(3) +
    '</text>' +
    line +
    shapes +
    '<text x="18" y="283">' +
    a.rowsMatched +
    ' / ' +
    a.rowsTotal +
    ' filas · ' +
    (points.length ? offset + 1 : 0) +
    '–' +
    (offset + points.length) +
    ' / ' +
    a.points.length +
    ' grupos</text></svg>'
  )
}
