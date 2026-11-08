import { useState, type FormEvent } from 'react'
import {
  ArrowDownToLine,
  ArrowUpRight,
  FileText,
  GitBranch,
  Loader2,
  Paperclip,
  Plus,
  Square,
  X
} from 'lucide-react'
import { fileTypes } from '../shared/file-types'
import { ArtifactPanel } from './Lab'
import { money, stopLabels } from '../shared/catalog'
import type { Attachment, Run } from '../shared/types'
import { api, formatTokens, shortDate, useWorkspace } from './lib'
import { Empty, Modal, ProviderMark, SectionTitle, Status } from './components'
import { ImprovementChart } from './Charts'

export function NewMission({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  onCreated: (run: Run) => void
}) {
  const { snapshot, refresh, notify } = useWorkspace()
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('auto')
  const [reviewer, setReviewer] = useState('auto')
  const [files, setFiles] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [budget, setBudget] = useState('0.50')
  const [iterations, setIterations] = useState(8)
  const [target, setTarget] = useState(90)
  const [session, setSession] = useState('general')
  const settings = snapshot?.settings
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const run = await api<Run>('/runs', {
        prompt,
        model,
        reviewer,
        attachments: files,
        budget: Number(budget),
        maxIterations: iterations,
        target,
        session
      })
      await refresh()
      onCreated(run)
      onOpenChange(false)
      setPrompt('')
      setFiles([])
      notify('Misión iniciada.')
    } catch (error) {
      notify((error as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  async function attach(list: FileList | null) {
    if (!list) return
    const loaded: Attachment[] = []
    for (const file of Array.from(list)) {
      if (file.size > 5_000_000 || files.length + loaded.length >= 5) {
        notify('Hasta cinco archivos de 5 MB cada uno.', true)
        break
      }
      const ext = file.name.split('.').at(-1)?.toLowerCase()
      const mime = fileTypes[ext as keyof typeof fileTypes] || file.type
      if (!Object.values(fileTypes).some((t) => t === mime)) {
        notify(`Formato no admitido: ${file.name}`, true)
        continue
      }
      const encoded = await new Promise<string>((done, reject) => {
        const reader = new FileReader()
        reader.onload = () => done(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      loaded.push({ name: file.name, type: mime, data: encoded })
    }
    setFiles((previous) => [...previous, ...loaded])
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Una nueva misión">
      <form onSubmit={submit} className="mission-form">
        <label className="field-label" htmlFor="mission-prompt">
          ¿Qué vamos a resolver?
        </label>
        <textarea
          id="mission-prompt"
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          minLength={3}
          maxLength={30000}
          required
          rows={5}
          placeholder="Describe el objetivo"
        />
        <div className="attachment-list">
          {files.map((file, i) => (
            <span key={`${file.name}-${i}`}>
              <FileText size={12} />
              {file.name}
              <button
                type="button"
                aria-label={`Quitar ${file.name}`}
                onClick={() => setFiles((f) => f.filter((_, index) => index !== i))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <label className="attach-button">
          <Paperclip size={14} />
          Añadir archivos o imágenes
          <input
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.txt,.md,.json,.csv,.pdf,.docx,.xlsx"
            onChange={(e) => void attach(e.target.files)}
          />
        </label>
        <div className="form-grid">
          <label>
            Agente constructor
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="auto">Router automático</option>
              {settings?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Agente revisor
            <select value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option value="auto">Automático según la tarea</option>
              {settings?.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid thirds">
          <label>
            Presupuesto, USD
            <input
              type="number"
              min="0.001"
              max="100"
              step="0.001"
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label>
            Máximo de iteraciones
            <input
              type="number"
              min="1"
              max="20"
              value={iterations}
              onChange={(e) => setIterations(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Objetivo, 0–100
            <input
              type="number"
              min="1"
              max="100"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              required
            />
          </label>
        </div>
        <label className="room-field">
          <GitBranch size={14} />
          Sala de colaboración
          <input
            value={session}
            onChange={(e) => setSession(e.target.value)}
            pattern="[a-zA-Z0-9_-]{1,60}"
            required
            aria-label="Sala de colaboración"
          />
        </label>
        <div className="dialog-footer">
          <button type="button" className="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={busy || !prompt.trim()}>
            {busy ? <Loader2 className="spin" size={15} /> : <ArrowUpRight size={15} />}Iniciar
            misión
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function MissionDetail({ run, onClose }: { run: Run | null; onClose: () => void }) {
  const { snapshot, refresh, notify } = useWorkspace()
  const current = snapshot?.runs.find((r) => r.id === run?.id) || run
  const [selectedStep, setSelectedStep] = useState(0)
  const [tab, setTab] = useState('result')
  const events = snapshot?.events.filter((e) => e.runId === current?.id).slice(-40) || []
  async function stop() {
    try {
      await api(`/runs/${current!.id}/stop`, {})
      await refresh()
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  return (
    <Modal
      open={!!current}
      onOpenChange={(value) => !value && onClose()}
      title={current?.title || 'Misión'}
      description={current ? `${current.id.slice(0, 8)}` : ''}
      drawer
    >
      {current && (
        <>
          <div className="detail-status">
            <Status run={current} />
            <span>{current.iterations.length} iteraciones</span>
            <span>{money(current.costNano)} USD</span>
            {['running', 'queued'].includes(current.status) && (
              <button className="button danger small-button" onClick={() => void stop()}>
                <Square size={12} />
                Detener
              </button>
            )}
          </div>
          <div className="detail-chart">
            <ImprovementChart runs={[current]} />
          </div>
          {current.stopReason && (
            <div className="stop-reason">
              <i />
              {stopLabels[current.stopReason]}
            </div>
          )}
          <div className="tabs detail-tabs">
            {[
              ['result', 'Resultado'],
              ['iterations', 'Iteraciones'],
              ['events', 'Actividad']
            ].map(([id, title]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                {title}
              </button>
            ))}
          </div>
          <div className="detail-body">
            {tab === 'result' && (
              <>
                <div className="eyebrow">OBJETIVO</div>
                <p>{current.prompt}</p>
                <div className="eyebrow spaced">RESULTADO</div>
                {current.result ? (
                  <pre className="result-content">{current.result}</pre>
                ) : current.error || !['queued', 'running'].includes(current.status) ? (
                  <p>{current.error || 'Sin resultado.'}</p>
                ) : (
                  <div className="waiting-state">
                    <Loader2 size={17} className="spin" />
                    Esperando el primer candidato…
                  </div>
                )}
                {current.artifacts?.map((id) => (
                  <ArtifactPanel key={id} id={id} kind={current.charts?.[id]} />
                ))}
                {!!current.steps?.length && (
                  <section className="workflow-view">
                    <h3>Flujo de ejecución</h3>
                    <div className="workflow-nodes">
                      {current.steps.map((step, i) => (
                        <button
                          key={i}
                          aria-pressed={selectedStep === i}
                          onClick={() => setSelectedStep(i)}
                        >
                          {(
                            {
                              ingest: 'Ingesta',
                              plan: 'Planificación',
                              execute: 'Ejecución',
                              memory: 'Memoria',
                              tool: 'Herramienta',
                              verify: 'Verificación',
                              handoff: 'Asignación',
                              review: 'Revisión'
                            } as Record<string, string>
                          )[step.role] || step.role}
                        </button>
                      ))}
                    </div>
                    {current.steps[selectedStep] && (
                      <p>
                        {current.steps[selectedStep].model} {current.steps[selectedStep].detail}
                      </p>
                    )}
                  </section>
                )}
                {current.unknownUsage && (
                  <p className="error-text">
                    Uso incompleto: el proveedor no devolvió todos los datos de tokens.
                  </p>
                )}
              </>
            )}
            {tab === 'iterations' &&
              [...current.iterations].reverse().map((item) => (
                <div className="iteration-item" key={item.index}>
                  <div>
                    <strong>Iteración {String(item.index).padStart(2, '0')}</strong>
                    <span className={item.accepted ? 'positive' : 'muted'}>
                      {item.score}/100 · {item.accepted ? 'aceptada' : 'conservada la anterior'}
                    </span>
                  </div>
                  <p>{item.verdict}</p>
                  <small>
                    {formatTokens(item.tokens)} tokens · {(item.latency / 1000).toFixed(1)} s ·{' '}
                    {money(item.costNano)} acumulados
                  </small>
                </div>
              ))}
            {tab === 'events' &&
              (events.length ? (
                events.map((item) => (
                  <div key={item.id} className="event-line">
                    <span>{new Date(item.createdAt).toLocaleTimeString('es-MX')}</span>
                    <p>{item.text}</p>
                  </div>
                ))
              ) : (
                <p className="muted">Sin eventos registrados.</p>
              ))}
          </div>
        </>
      )}
    </Modal>
  )
}

export function Missions({ onNew, onSelect }: { onNew: () => void; onSelect: (run: Run) => void }) {
  const { snapshot } = useWorkspace()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const runs =
    snapshot?.runs.filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        r.title.toLowerCase().includes(query.toLowerCase())
    ) || []
  return (
    <>
      <SectionTitle title="Misiones">
        <a className="button" href="/api/export" download>
          <ArrowDownToLine size={14} />
          Exportar
        </a>
        <button className="button primary" onClick={onNew}>
          <Plus size={15} />
          Nueva misión
        </button>
      </SectionTitle>
      <div className="list-toolbar">
        <div className="tabs">
          {[
            ['all', 'Todas'],
            ['running', 'En curso'],
            ['completed', 'Completadas'],
            ['failed', 'Con error']
          ].map(([id, title]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={filter === id ? 'active' : ''}
            >
              {title}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          aria-label="Buscar misiones"
          placeholder="Buscar una misión…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {runs.length ? (
        <div className="mission-list panel">
          <div className="mission-list-heading">
            <span>Misión</span>
            <span>Modelo</span>
            <span>Evaluación</span>
            <span>Coste USD</span>
            <span>Estado</span>
          </div>
          {runs.map((run) => (
            <button key={run.id} className="mission-row" onClick={() => onSelect(run)}>
              <div>
                <div>
                  <strong>{run.title}</strong>
                  <small>
                    {shortDate(run.createdAt)} · {run.iterations.length} iteraciones · {run.model}
                  </small>
                </div>
              </div>
              <span className="model-cell">
                {snapshot?.settings.models.find((m) => m.id === run.model)?.name || run.model}
              </span>
              <span className="score-cell">
                {run.iterations.length
                  ? Math.max(...run.iterations.map((x) => x.score)).toFixed(0)
                  : '—'}
                <small>/100</small>
              </span>
              <span className="mono">{money(run.costNano)}</span>
              <Status run={run} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Sin misiones"
          action={
            <button className="button primary" onClick={onNew}>
              Nueva misión
            </button>
          }
        />
      )}
    </>
  )
}
