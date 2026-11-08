import { useEffect, useRef, useState } from 'react'
import { Download, FileUp, ArrowRight } from 'lucide-react'
import { api, useWorkspace } from './lib'
import { SectionTitle } from './components'
import { fileTypes } from '../shared/file-types'
import type { Profile, AnalysisArtifact, AnalysisPlan } from '../shared/analysis'
import type { Attachment } from '../shared/types'

export async function readUpload(file: File): Promise<Attachment> {
  if (file.size > 5000000 || !file.size) throw new Error('Selecciona un archivo de hasta 5 MB.')
  const type = fileTypes[file.name.split('.').at(-1)?.toLowerCase() as keyof typeof fileTypes]
  if (!type || type.startsWith('image')) throw new Error('Formato de documento no admitido.')
  const data = await new Promise<string>((done, reject) => {
    const r = new FileReader()
    r.onload = () => done(String(r.result).split(',')[1])
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    r.readAsDataURL(file)
  })
  return { name: file.name, type, data }
}
export function ArtifactPanel({ id, kind = 'bar' }: { id: string; kind?: 'bar' | 'line' }) {
  const { notify } = useWorkspace()
  const [experienceBusy, setExperienceBusy] = useState(false)
  const [a, setA] = useState<AnalysisArtifact>(),
    [chart, setChart] = useState(kind),
    [offset, setOffset] = useState(0),
    [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    setA(undefined)
    setOffset(0)
    setChart(kind)
    setError('')
    api<AnalysisArtifact>('/lab/artifacts/' + id)
      .then((v) => alive && setA(v))
      .catch((e) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [id, kind])
  if (!a) return <p role="status">{error || 'Cargando resultado…'}</p>
  const url = '/api/lab/artifacts/' + id + '/chart.svg?kind=' + chart + '&offset=' + offset
  return (
    <section className="lab-result">
      <header>
        <h3>{a.source}</h3>
        <select
          value={chart}
          aria-label="Tipo de gráfica"
          onChange={(e) => setChart(e.target.value as typeof chart)}
        >
          <option value="bar">Barras</option>
          <option value="line">Línea</option>
        </select>
        <a className="button" href={url} download={id + '.svg'}>
          <Download size={14} />
          SVG
        </a>
        <a className="button" href={'/api/lab/artifacts/' + id} download={id + '.json'}>
          JSON
        </a>
      </header>
      <img src={url} alt={'Gráfica de ' + a.source} />
      <div className="lab-table">
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Resultado {a.currency}</th>
              <th>Filas</th>
            </tr>
          </thead>
          <tbody>
            {a.points.slice(offset, offset + 32).map((p) => (
              <tr key={p.label}>
                <td>{p.label || 'Vacío'}</td>
                <td>{p.value}</td>
                <td>{p.rows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.points.length > 32 && (
        <footer>
          <button className="button" disabled={!offset} onClick={() => setOffset(offset - 32)}>
            Anterior
          </button>
          <button
            className="button"
            disabled={offset + 32 >= a.points.length}
            onClick={() => setOffset(offset + 32)}
          >
            Siguiente
          </button>
        </footer>
      )}
      <details>
        <summary>Procedencia y verificación</summary>
        <p>
          {a.rowsMatched} / {a.rowsTotal} filas · {a.sheet} · DuckDB y comprobación decimal
          independiente
        </p>
        <code>{a.sha256}</code>
        <pre>{JSON.stringify(a.plan, null, 2)}</pre>
        {a.warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
      </details>
      <details>
        <summary>Validar para memoria</summary>
        <form
          className="lab-form"
          onSubmit={async (e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            setExperienceBusy(true)
            try {
              await api('/lab/artifacts/' + id + '/experience', {
                prompt: String(form.get('question')),
                expected: JSON.parse(String(form.get('expected')))
              })
              notify('Experiencia verificada en desarrollo.')
            } catch (error) {
              notify((error as Error).message, true)
            } finally {
              setExperienceBusy(false)
            }
          }}
        >
          <label>
            Pregunta resuelta
            <input name="question" required minLength={3} />
          </label>
          <label>
            Referencia independiente (JSON de pares label/value)
            <textarea name="expected" required rows={3} />
          </label>
          <button className="button" disabled={experienceBusy}>
            Verificar referencia
          </button>
        </form>
      </details>
    </section>
  )
}
export function Lab() {
  const { notify } = useWorkspace()
  const [file, setFile] = useState<Attachment>(),
    [profile, setProfile] = useState<Profile>(),
    [busy, setBusy] = useState(false),
    [id, setId] = useState(''),
    [query, setQuery] = useState(''),
    [hits, setHits] = useState<{ location: string; text: string }[] | null>(null)
  const [plan, setPlan] = useState<AnalysisPlan>({ aggregation: 'count' })
  const [filterColumn, setFilterColumn] = useState(''),
    [filterValue, setFilterValue] = useState('')
  const input = useRef<HTMLInputElement>(null)
  async function load(source: Attachment, sheet?: string) {
    setFile(source)
    setProfile(undefined)
    setId('')
    setHits(null)
    setPlan({ aggregation: 'count' })
    setFilterColumn('')
    setFilterValue('')
    setProfile(await api('/lab/inspect', { file: source, sheet }))
  }
  async function work(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  const cols = profile?.columns || []
  return (
    <>
      <SectionTitle title="Análisis de archivos">
        <button className="button primary" disabled={busy} onClick={() => input.current?.click()}>
          <FileUp size={14} />
          Abrir archivo
        </button>
        <input
          hidden
          ref={input}
          type="file"
          accept=".csv,.xlsx,.docx,.pdf,.txt,.md,.json"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void work(async () => load(await readUpload(f)))
          }}
        />
      </SectionTitle>
      <section className="panel lab-panel">
        {busy && <p role="status">Procesando…</p>}
        {!profile && !busy && <p>Abre un CSV, Excel, PDF, Word, JSON o texto.</p>}
        {profile && (
          <>
            <header>
              <h2>{profile.source}</h2>
              {profile.sheets.length > 0 && (
                <select
                  aria-label="Hoja"
                  disabled={busy}
                  value={profile.sheet || ''}
                  onChange={(e) => void work(() => load(file!, e.target.value))}
                >
                  {profile.sheets.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </header>
            {profile.columns ? (
              <>
                <p>
                  {profile.rows?.toLocaleString()} filas · {cols.length} columnas ·{' '}
                  {profile.duplicates} filas duplicadas
                </p>
                <details>
                  <summary>Perfil de columnas</summary>
                  <div className="lab-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Columna</th>
                          <th>Tipo</th>
                          <th>Nulos</th>
                          <th>Distintos</th>
                          <th>Fechas inválidas</th>
                          <th>Atípicos (IQR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cols.map((c) => (
                          <tr key={c.name}>
                            <td>{c.name}</td>
                            <td>{c.type}</td>
                            <td>{c.nulls}</td>
                            <td>{c.distinct}</td>
                            <td>{c.invalidDates ?? '—'}</td>
                            <td>{c.outliersIQR ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <form
                  className="lab-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void work(async () => {
                      setId('')
                      const a = await api<AnalysisArtifact>('/lab/analyze', {
                        file,
                        sheet: profile.sheet || undefined,
                        plan: {
                          ...plan,
                          filters: filterColumn
                            ? [{ column: filterColumn, equals: filterValue }]
                            : []
                        }
                      })
                      setId(a.id)
                    })
                  }}
                >
                  <label>
                    Operación
                    <select
                      value={plan.aggregation}
                      onChange={(e) =>
                        setPlan({
                          ...plan,
                          aggregation: e.target.value as AnalysisPlan['aggregation']
                        })
                      }
                    >
                      {Object.entries({
                        count: 'Contar',
                        sum: 'Sumar',
                        mean: 'Promedio',
                        min: 'Mínimo',
                        max: 'Máximo',
                        median: 'Mediana',
                        stddev: 'Desviación poblacional'
                      }).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {plan.aggregation !== 'count' && (
                    <label>
                      Métrica
                      <select
                        required
                        value={plan.metric || ''}
                        onChange={(e) => setPlan({ ...plan, metric: e.target.value })}
                      >
                        <option value="">Seleccionar</option>
                        {cols.map((c) => (
                          <option key={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Agrupar por
                    <select
                      value={plan.group_by || ''}
                      onChange={(e) =>
                        setPlan({
                          ...plan,
                          group_by: e.target.value || undefined,
                          period: undefined
                        })
                      }
                    >
                      <option value="">Total</option>
                      {cols.map((c) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  {plan.group_by && (
                    <label>
                      Periodo
                      <select
                        value={plan.period || ''}
                        onChange={(e) =>
                          setPlan({ ...plan, period: e.target.value ? 'month' : undefined })
                        }
                      >
                        <option value="">Valor original</option>
                        <option value="month">Mes de fecha ISO</option>
                      </select>
                    </label>
                  )}
                  <label>
                    Columna de divisa
                    <select
                      value={plan.currency_column || ''}
                      onChange={(e) =>
                        setPlan({ ...plan, currency_column: e.target.value || undefined })
                      }
                    >
                      <option value="">Sin divisa</option>
                      {cols.map((c) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Filtrar columna
                    <select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)}>
                      <option value="">Todas las filas</option>
                      {cols.map((c) => (
                        <option key={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  {filterColumn && (
                    <label>
                      Igual a
                      <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
                    </label>
                  )}
                  <button className="button primary" disabled={busy}>
                    Calcular <ArrowRight size={14} />
                  </button>
                </form>
              </>
            ) : (
              <form
                className="lab-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void work(async () => setHits((await api('/lab/search', { file, query })).hits))
                }}
              >
                <label>
                  Buscar en el documento
                  <input required value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <button disabled={busy} className="button">
                  Buscar
                </button>
              </form>
            )}
            {profile.warnings.slice(0, 8).map((w) => (
              <p key={w}>{w}</p>
            ))}
            {hits?.map((h, i) => (
              <blockquote key={i}>
                <strong>
                  {profile.source} · {h.location}
                </strong>
                <p>{h.text}</p>
              </blockquote>
            ))}
            {hits?.length === 0 && <p>Sin coincidencias.</p>}
          </>
        )}
      </section>
      {id && (
        <div className="panel lab-panel">
          <ArtifactPanel id={id} />
        </div>
      )}
    </>
  )
}
