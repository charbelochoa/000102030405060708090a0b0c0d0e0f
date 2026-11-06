import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  GitBranch,
  History,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  X
} from 'lucide-react'
import type { EvolutionState, Experiment } from '../shared/evolution'
import { api, useWorkspace } from './lib'
import { Empty, Modal, SectionTitle } from './components'

export function Evolution() {
  const { notify, refresh } = useWorkspace()
  const [state, setState] = useState<EvolutionState | null>(null)
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState<Experiment | null>(null)
  async function load() {
    try {
      setState(await api('/evolution'))
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  async function optimize() {
    setBusy('optimize')
    try {
      const result = await api<Experiment>('/optimizations', {})
      await load()
      await refresh()
      setSelected(result)
      notify(
        `Candidato ${result.candidateVersion}: ${result.status === 'accepted' ? 'aceptado' : 'rechazado'}.`
      )
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy('')
    }
  }
  async function restore(id: string) {
    setBusy(id)
    try {
      await api(`/versions/${id}/restore`, {})
      await load()
      await refresh()
      notify(`Restaurada la política ${id}.`)
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy('')
    }
  }
  async function benchmark() {
    setBusy('benchmark')
    try {
      const report = await api('/benchmarks', { version: state!.stable, split: 'validation' })
      await load()
      await refresh()
      notify(`Validación: ${report.passed}/${report.count} casos correctos.`)
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy('')
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="MEJORAR TAMBIÉN TIENE UN MÉTODO"
        title="Evolución del sistema"
        subtitle="Políticas versionadas. Candidatos aislados. Cambios que se ganan su lugar."
      >
        <button className="button" onClick={() => void benchmark()} disabled={!!busy || !state}>
          {busy === 'benchmark' ? <Loader2 size={14} className="spin" /> : <Play size={13} />}
          Evaluar estable
        </button>
        <button className="button primary" onClick={() => void optimize()} disabled={!!busy}>
          {busy === 'optimize' ? <Loader2 size={14} className="spin" /> : <GitBranch size={14} />}
          Proponer mejora
        </button>
      </SectionTitle>
      <div className="settings-intro panel">
        <span className="section-icon">
          <ShieldCheck size={18} />
        </span>
        <div>
          <h2>De una hipótesis a una mejora verificable.</h2>
          <p>
            El optimizador analiza 20 casos de desarrollo de inventario sintético, genera
            candidate.json y compara las políticas con 15 casos de validación independientes. Solo
            promueve mejoras sin regresiones críticas. El conjunto final de 15 casos queda fuera de
            la optimización.
          </p>
        </div>
      </div>
      <div className="evolution-summary">
        <div className="panel">
          <span>VERSIÓN ESTABLE</span>
          <strong>{state?.stable || '—'}</strong>
          <small>Política activa de inventario</small>
        </div>
        <div className="panel">
          <span>EXPERIMENTOS</span>
          <strong>{state?.experiments.length || 0}</strong>
          <small>Incluye propuestas rechazadas</small>
        </div>
        <div className="panel">
          <span>MEJORAS ACEPTADAS</span>
          <strong>{state?.experiments.filter((e) => e.status === 'accepted').length || 0}</strong>
          <small>Validación determinista</small>
        </div>
        <div className="panel">
          <span>CONSUMO DE APIs</span>
          <strong>$0.00</strong>
          <small>Este benchmark no llama a LLMs</small>
        </div>
      </div>
      <div className="evolution-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <GitBranch size={14} />
              Historial de versiones
            </h2>
            <span className="tiny-label">POLÍTICAS JSON</span>
          </div>
          <div className="version-list">
            {state?.versions.map((v) => (
              <div className={`version-item ${v.id === state.stable ? 'stable' : ''}`} key={v.id}>
                <div className="version-node">{v.id}</div>
                <div>
                  <strong>
                    {v.id === state.stable
                      ? 'Versión estable'
                      : v.parent
                        ? `Candidata desde ${v.parent}`
                        : 'Baseline inicial'}
                  </strong>
                  <p>{v.hypothesis}</p>
                  <code>SHA256 {v.hash.slice(0, 16)}</code>
                </div>
                {v.id !== state.stable &&
                  (v.id === 'v1' ||
                    state.experiments.some(
                      (e) => e.candidateVersion === v.id && e.status === 'accepted'
                    )) && (
                    <button
                      className="icon-button"
                      title={`Restaurar ${v.id}`}
                      aria-label={`Restaurar ${v.id}`}
                      onClick={() => void restore(v.id)}
                      disabled={!!busy}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <History size={14} />
              Memoria experimental
            </h2>
          </div>
          {state?.experiments.length ? (
            state.experiments.map((e) => (
              <button className="experiment-item" key={e.id} onClick={() => setSelected(e)}>
                <div>
                  <span className={`experiment-status ${e.status}`}>
                    {e.status === 'accepted' ? <Check size={12} /> : <X size={12} />}
                    {e.status === 'accepted' ? 'ACEPTADA' : 'RECHAZADA'}
                  </span>
                  <span>
                    {e.sourceVersion}
                    <ArrowRight size={11} />
                    {e.candidateVersion}
                  </span>
                </div>
                <p>{e.reason}</p>
                <div>
                  <strong>
                    {e.stable.quality.toFixed(1)} %<ArrowRight size={14} />
                    {e.candidate.quality.toFixed(1)} %
                  </strong>
                  <ArrowUpRight size={14} />
                </div>
              </button>
            ))
          ) : (
            <Empty
              title="Toda mejora empieza con una pregunta"
              text="Propón una mejora para generar y evaluar la primera política candidata."
            />
          )}
        </section>
      </div>
      <section className="panel evolution-boundaries">
        <div>
          <h3>Qué cambia</h3>
          <p>
            El comportamiento de los filtros: presupuesto inclusivo, normalización de combustible y
            plazas mínimas. Las políticas aceptadas se usan en la herramienta search_inventory.
          </p>
        </div>
        <div>
          <h3>Qué mide</h3>
          <p>
            Coincidencia exacta de resultados y disponibilidad. Se registran tiempos reales. Este
            ensayo verifica políticas de software; no mide inteligencia general ni entrenamiento de
            pesos.
          </p>
        </div>
        <div>
          <h3>Cuándo para</h3>
          <p>
            Una propuesta por experimento. Si no existe mejora, el candidato se rechaza y la
            política estable permanece. Puedes restaurar cualquier versión previamente aceptada.
          </p>
        </div>
      </section>
      <Modal
        open={!!selected}
        onOpenChange={(value) => !value && setSelected(null)}
        title={
          selected ? `${selected.sourceVersion} → ${selected.candidateVersion}` : 'Experimento'
        }
        description="Evidencia del experimento local, sin llamadas a modelos."
      >
        {selected && (
          <div className="experiment-detail">
            <p>{selected.hypothesis}</p>
            <div className="experiment-score">
              <span>
                Estable
                <strong>
                  {selected.stable.passed}/{selected.stable.count}
                </strong>
              </span>
              <ArrowRight size={21} />
              <span>
                Candidata
                <strong>
                  {selected.candidate.passed}/{selected.candidate.count}
                </strong>
              </span>
              <span>
                Errores críticos<strong>{selected.candidate.criticalErrors}</strong>
              </span>
            </div>
            <div className="eyebrow">CAMBIOS PROPUESTOS</div>
            <pre>
              {selected.changes.join('\n') || 'Sin cambios: no se encontraron fallos corregibles.'}
            </pre>
            <p className="experiment-verdict">{selected.reason}</p>
            <div className="eyebrow">ARTEFACTOS LOCALES</div>
            <code className="artifact-path">{selected.artifact}</code>
            <div className="benchmark-cases">
              {selected.candidate.rows.map((row) => (
                <div key={row.taskId}>
                  {row.success ? <Check size={12} /> : <X size={12} />}
                  <span>{row.taskId}</span>
                  <span>{row.category}</span>
                  <span>{row.success ? 'Correcto' : 'Fallo'}</span>
                </div>
              ))}
            </div>
            <p className="view-footnote">
              candidate.json, experiment.json y REPORT.md quedan guardados en la carpeta del
              experimento. El optimizador no ejecutó el test final.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
