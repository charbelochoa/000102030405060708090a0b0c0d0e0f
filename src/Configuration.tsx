import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Check,
  FileUp,
  KeyRound,
  Loader2,
  Plus,
  Route,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap
} from 'lucide-react'
import { providers } from '../shared/catalog'
import type { Model, ProviderId, Settings } from '../shared/types'
import { api, useWorkspace } from './lib'
import { ExternalLink, Modal, ProviderMark, SectionTitle, Toggle } from './components'

export function Models({ router = false }: { router?: boolean }) {
  const { snapshot, refresh, notify } = useWorkspace()
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState('')
  const [addModel, setAddModel] = useState(false)
  const [draft, setDraft] = useState<Model[] | null>(null)
  const settings = snapshot!.settings
  useEffect(() => {
    if (!draft) setDraft(structuredClone(settings.models))
  }, [settings.models, draft])
  async function patch(input: Partial<Settings>) {
    try {
      await api('/settings', input, 'PATCH')
      await refresh()
      notify('Configuración guardada.')
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  async function connect(id: string, remove = false) {
    setSaving(id)
    try {
      await api(`/providers/${id}`, { key: remove ? '' : keys[id] || '' }, 'PUT')
      setKeys((k) => ({ ...k, [id]: '' }))
      await refresh()
      notify(remove ? 'Credencial eliminada.' : 'Credencial guardada en el servidor.')
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setSaving('')
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow={router ? 'EL MODELO ADECUADO PARA CADA RETO' : 'CONECTA TU INTELIGENCIA'}
        title={router ? 'Router de modelos' : 'Proveedores y APIs'}
        subtitle={
          router
            ? 'Asigna la complejidad. Equilibra capacidad, coste y contexto.'
            : 'Tus modelos. Tus claves. Un espacio de trabajo compartido.'
        }
      />
      <div className="settings-intro panel">
        <span className="section-icon">
          {router ? <Route size={18} /> : <KeyRound size={18} />}
        </span>
        <div>
          <h2>
            {router ? 'Un clasificador, múltiples posibilidades.' : 'Preparado para conectar.'}
          </h2>
          <p>
            {router
              ? 'El clasificador elige un nivel de complejidad. El router selecciona el modelo configurado más económico de ese nivel; su consumo también se registra.'
              : 'Las claves se guardan cifradas en el servidor local y nunca se devuelven al navegador. Puedes usar variables de entorno o añadirlas aquí.'}
          </p>
        </div>
      </div>
      {router && (
        <section className="panel settings-section">
          <div className="setting-row">
            <div>
              <h3>Enrutamiento automático</h3>
              <p>Usar el clasificador designado al seleccionar “Router automático”.</p>
            </div>
            <Toggle
              checked={settings.router}
              onChange={(value) => void patch({ router: value })}
              label="Activar router"
            />
          </div>
          <div className="setting-row">
            <div>
              <h3>Modelo clasificador</h3>
              <p>Si no está conectado, se usan reglas locales de complejidad.</p>
            </div>
            <select
              value={settings.routerModel}
              onChange={(e) => void patch({ routerModel: e.target.value })}
            >
              {settings.models.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="routing-path">
            <span>Tu objetivo</span>
            <ArrowRight size={15} />
            <span>Complejidad</span>
            <ArrowRight size={15} />
            <span>Modelo disponible</span>
            <ArrowRight size={15} />
            <span>Evaluación</span>
          </div>
        </section>
      )}
      <div className="provider-grid">
        {providers.map((p) => {
          const config = settings.providers.find((c) => c.id === p.id)!
          return (
            <section className="panel provider-card" key={p.id}>
              <div className="provider-card-header">
                <div>
                  <ProviderMark provider={p.id} />
                  <h2>{p.name}</h2>
                </div>
                <Toggle
                  checked={config.enabled}
                  onChange={(value) =>
                    void patch({
                      providers: settings.providers.map((c) =>
                        c.id === p.id ? { ...c, enabled: value } : c
                      )
                    })
                  }
                  label={`Activar ${p.name}`}
                />
              </div>
              <div className={`connection-state ${config.hasKey ? 'connected' : ''}`}>
                <i />
                {config.hasKey ? 'Credencial configurada' : 'Sin conectar'}
              </div>
              <label className="key-field">
                <KeyRound size={13} />
                <input
                  type="password"
                  autoComplete="new-password"
                  aria-label={`API key de ${p.name}`}
                  placeholder={config.hasKey ? 'Añadir una nueva clave' : 'Pega tu API key'}
                  value={keys[p.id] || ''}
                  onChange={(e) => setKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                />
              </label>
              <div className="provider-card-bottom">
                <span>
                  {settings.models.filter((m) => m.provider === p.id).length} modelos configurados
                </span>
                <button
                  className="button small-button"
                  disabled={!keys[p.id]?.trim() || saving === p.id}
                  onClick={() => void connect(p.id)}
                >
                  {saving === p.id ? <Loader2 className="spin" size={12} /> : <Plus size={12} />}
                  {config.hasKey ? 'Actualizar' : 'Conectar'}
                </button>
                {config.hasKey && (
                  <button className="link-button muted" onClick={() => void connect(p.id, true)}>
                    Quitar
                  </button>
                )}
              </div>
              {p.id === 'google' && (
                <div className="free-tier-setting">
                  <span>Mi cuenta usa la cuota gratuita</span>
                  <Toggle
                    label="Declarar cuota gratuita de Gemini"
                    checked={config.freeTier}
                    onChange={(value) =>
                      void patch({
                        providers: settings.providers.map((c) =>
                          c.id === p.id ? { ...c, freeTier: value } : c
                        )
                      })
                    }
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>
      <section className="panel tariff-panel">
        <div className="panel-heading">
          <div>
            <h2>Tarifas por modelo</h2>
            <p>USD por millón de tokens. Tarifa estándar, antes de impuestos y extras.</p>
          </div>
          <button className="button small-button" onClick={() => setAddModel(true)}>
            <Plus size={13} />
            Añadir modelo
          </button>
        </div>
        <div className="tariff-table-wrap">
          <table className="tariff-table">
            <thead>
              <tr>
                <th>MODELO</th>
                <th>NIVEL</th>
                <th>ENTRADA</th>
                <th>SALIDA</th>
                <th>CACHÉ</th>
                <th>VISIÓN</th>
                <th>FUENTE</th>
              </tr>
            </thead>
            <tbody>
              {(draft || []).map((m, i) => (
                <tr key={m.id}>
                  <td>
                    <ProviderMark provider={m.provider} compact />
                    <span>
                      {m.name}
                      <small>{m.id}</small>
                    </span>
                  </td>
                  <td>
                    <select
                      aria-label={`Nivel de ${m.name}`}
                      value={m.tier}
                      onChange={(e) =>
                        setDraft((v) =>
                          v!.map((x, n) =>
                            n === i ? { ...x, tier: e.target.value as Model['tier'] } : x
                          )
                        )
                      }
                    >
                      {['low', 'medium', 'high', 'reasoning'].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  {(['inputPrice', 'outputPrice', 'cachedPrice'] as const).map((key) => (
                    <td key={key}>
                      <input
                        aria-label={`${key} de ${m.name}`}
                        type="number"
                        step="0.001"
                        min="0"
                        max="1000"
                        value={m[key]}
                        onChange={(e) =>
                          setDraft((v) =>
                            v!.map((x, n) =>
                              n === i ? { ...x, [key]: Number(e.target.value) } : x
                            )
                          )
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <Toggle
                      label={`Visión de ${m.name}`}
                      checked={m.vision}
                      onChange={(value) =>
                        setDraft((v) => v!.map((x, n) => (n === i ? { ...x, vision: value } : x)))
                      }
                    />
                  </td>
                  <td>
                    <ExternalLink href={m.source}>Ver tarifa</ExternalLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tariff-footer">
          <span>
            Referencias consultadas: 6 nov 2026. Los cambios del proveedor requieren actualizar la
            tarifa.
          </span>
          <button
            className="button"
            onClick={() => void patch({ models: draft || settings.models })}
          >
            <Save size={13} />
            Guardar tarifas
          </button>
        </div>
      </section>
      <p className="view-footnote">
        La cuota gratuita es una declaración de tu cuenta; AERIS no puede comprobar la factura del
        proveedor. Los costes se calculan con el uso reportado en cada respuesta. Herramientas
        externas, almacenamiento, tarifas regionales y descuentos específicos requieren sus propias
        tarifas.
      </p>
      <AddModel
        open={addModel}
        onOpenChange={setAddModel}
        onSave={async (m) => {
          const next = [...(draft || settings.models), m]
          await api('/settings', { models: next }, 'PATCH')
          setDraft(next)
          await refresh()
        }}
      />
    </>
  )
}

function AddModel({
  open,
  onOpenChange,
  onSave
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  onSave: (model: Model) => Promise<void>
}) {
  const { notify } = useWorkspace()
  const [provider, setProvider] = useState<ProviderId>('deepseek')
  const [tier, setTier] = useState<Model['tier']>('medium')
  const [vision, setVision] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await onSave({
        id: String(form.get('id')),
        name: String(form.get('name')),
        provider,
        tier,
        vision,
        inputPrice: Number(form.get('input')),
        outputPrice: Number(form.get('output')),
        cachedPrice: Number(form.get('cached')),
        cacheWritePrice: Number(form.get('write')),
        source: String(form.get('source')),
        checkedAt: new Date().toISOString().slice(0, 10)
      })
      onOpenChange(false)
      notify('Modelo añadido.')
    } catch (error) {
      notify((error as Error).message, true)
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir un modelo"
      description="Usa el identificador y las tarifas publicados por tu proveedor."
    >
      <form className="mission-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Nombre
            <input name="name" required maxLength={100} placeholder="DeepSeek Flash" />
          </label>
          <label>
            ID del modelo
            <input
              name="id"
              required
              pattern="[a-zA-Z0-9._:/-]{1,100}"
              placeholder="deepseek-flash"
            />
          </label>
          <label>
            Proveedor
            <select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
              {providers.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nivel
            <select value={tier} onChange={(e) => setTier(e.target.value as Model['tier'])}>
              {['low', 'medium', 'high', 'reasoning'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Entrada / 1 M tokens
            <input name="input" type="number" min="0" max="1000" step="0.0001" required />
          </label>
          <label>
            Salida / 1 M tokens
            <input name="output" type="number" min="0" max="1000" step="0.0001" required />
          </label>
          <label>
            Lectura de caché / 1 M
            <input name="cached" type="number" min="0" max="1000" step="0.0001" required />
          </label>
          <label>
            Escritura de caché / 1 M
            <input name="write" type="number" min="0" max="1000" step="0.0001" required />
          </label>
        </div>
        <label>
          Fuente de precios
          <input name="source" type="url" required placeholder="https://api-docs.deepseek.com/…" />
        </label>
        <div className="setting-row">
          <span>Admite imágenes</span>
          <Toggle label="Modelo con visión" checked={vision} onChange={setVision} />
        </div>
        <div className="dialog-footer">
          <button className="button primary" type="submit">
            Añadir modelo
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Skills() {
  const { snapshot, refresh, notify } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  async function toggle(id: string, enabled: boolean) {
    try {
      await api(`/skills/${id}`, { enabled }, 'PATCH')
      await refresh()
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await api('/skills', {
        name: form.get('name'),
        description: form.get('description'),
        content
      })
      await refresh()
      setOpen(false)
      setContent('')
      notify('Skill añadida y activada.')
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="BUEN CRITERIO, POR DEFECTO"
        title="Skills"
        subtitle="Dale a tus agentes instrucciones reutilizables, sin añadir ruido."
      >
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={14} />
          Añadir skill
        </button>
      </SectionTitle>
      <div className="settings-intro panel">
        <span className="section-icon">
          <Sparkles size={18} />
        </span>
        <div>
          <h2>Hacer más también significa escribir menos.</h2>
          <p>
            Caveman y Ponytail están activos desde el inicio. Los perfiles compactos preservan sus
            principios y reducen el contexto enviado en cada llamada. El ahorro se mide por
            ejecución.
          </p>
        </div>
      </div>
      <div className="skills-grid">
        {snapshot?.skills.map((s, i) => (
          <article className="panel skill-card" key={s.id}>
            <div className="skill-card-top">
              <span className="skill-glyph">{['cv_', 'pt_', 'ev_'][i] || 'sk_'}</span>
              <Toggle
                checked={s.enabled}
                onChange={(value) => void toggle(s.id, value)}
                label={`Activar ${s.name}`}
              />
            </div>
            <h2>
              {s.name}
              <span className="tiny-label">{s.builtin ? 'PREDETERMINADA' : 'PERSONALIZADA'}</span>
            </h2>
            <p>{s.description}</p>
            <div className="skill-content">{s.content}</div>
            <div className="skill-card-footer">
              <span>
                <i className={`subtle-dot ${s.enabled ? 'positive-dot' : ''}`} />
                {s.enabled ? 'Activa en cada misión' : 'Desactivada'}
              </span>
              {s.source && <ExternalLink href={s.source}>Fuente</ExternalLink>}
            </div>
          </article>
        ))}
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Una nueva habilidad"
        description="Añade las instrucciones o importa un archivo Markdown."
      >
        <form className="mission-form" onSubmit={add}>
          <label>
            Nombre
            <input
              name="name"
              required
              minLength={2}
              maxLength={60}
              placeholder="Revisión de APIs"
            />
          </label>
          <label>
            Descripción
            <input
              name="description"
              required
              maxLength={200}
              placeholder="Qué aporta esta skill a tus agentes"
            />
          </label>
          <label className="attach-button">
            <FileUp size={14} />
            Importar SKILL.md
            <input
              type="file"
              accept=".md,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file && file.size <= 24000) setContent(await file.text())
                else notify('Límite: 24 KB por skill.', true)
              }}
            />
          </label>
          <label>
            Instrucciones
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              minLength={10}
              maxLength={24000}
              rows={9}
            />
          </label>
          <div className="dialog-footer">
            <button className="button primary" type="submit">
              Guardar skill
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function Configuration() {
  const { snapshot, refresh, notify } = useWorkspace()
  const [draft, setDraft] = useState<Settings>(structuredClone(snapshot!.settings))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }))
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const { models, providers: configs, ...input } = draft
      await api('/settings', input, 'PATCH')
      await refresh()
      notify('Preferencias guardadas.')
    } catch (error) {
      notify((error as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <SectionTitle
        eyebrow="UN ESPACIO A TU MEDIDA"
        title="Configuración"
        subtitle="Decide cómo trabajan tus agentes y cuándo deben detenerse."
      />
      <form onSubmit={save} className="configuration-form">
        <section className="panel settings-section">
          <div className="settings-section-title">
            <SlidersHorizontal size={17} />
            <h2>Criterios de ejecución</h2>
          </div>
          <div className="form-grid">
            <label>
              Presupuesto por misión, USD
              <input
                type="number"
                min="0.001"
                max="100"
                step="0.001"
                required
                value={draft.budget}
                onChange={(e) => set('budget', Number(e.target.value))}
              />
              <small>El límite se reserva antes de cada solicitud.</small>
            </label>
            <label>
              Máximo de iteraciones
              <input
                type="number"
                min="1"
                max="20"
                required
                value={draft.maxIterations}
                onChange={(e) => set('maxIterations', Number(e.target.value))}
              />
            </label>
            <label>
              Calidad objetivo, 0–100
              <input
                type="number"
                min="1"
                max="100"
                required
                value={draft.target}
                onChange={(e) => set('target', Number(e.target.value))}
              />
            </label>
            <label>
              Paciencia, iteraciones sin mejora
              <input
                type="number"
                min="1"
                max="10"
                required
                value={draft.patience}
                onChange={(e) => set('patience', Number(e.target.value))}
              />
            </label>
            <label>
              Mejora mínima, puntos
              <input
                type="number"
                min="0.1"
                max="20"
                step="0.1"
                required
                value={draft.minDelta}
                onChange={(e) => set('minDelta', Number(e.target.value))}
              />
            </label>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-section-title">
            <Zap size={17} />
            <h2>Optimizador de salida</h2>
          </div>
          <div className="setting-row">
            <div>
              <h3>Modo conciso adaptativo</h3>
              <p>
                Reduce la salida solicitada al acercarse al presupuesto. Las evaluaciones siguen
                contabilizadas.
              </p>
            </div>
            <Toggle
              label="Activar optimizador"
              checked={draft.optimizer}
              onChange={(value) => set('optimizer', value)}
            />
          </div>
          <label className="range-label">
            Activar al consumir el {Math.round(draft.quietThreshold * 100)} % del presupuesto
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={draft.quietThreshold}
              onChange={(e) => set('quietThreshold', Number(e.target.value))}
            />
          </label>
          <p className="muted small-copy">
            Ocultar mensajes no reduce los tokens de razonamiento facturados. El optimizador cambia
            la longitud solicitada y los límites de salida.
          </p>
        </section>
        <section className="panel settings-section">
          <div className="settings-section-title">
            <ShieldCheck size={17} />
            <h2>Espacio de trabajo</h2>
          </div>
          <div className="workspace-path">{snapshot?.workspace}</div>
          <div className="setting-row">
            <div>
              <h3>Crear y editar archivos</h3>
              <p>Permitir escritura dentro de este espacio, con rutas protegidas.</p>
            </div>
            <Toggle
              label="Permitir escritura"
              checked={draft.allowWrites}
              onChange={(value) => set('allowWrites', value)}
            />
          </div>
          <div className="setting-row">
            <div>
              <h3>Comprobaciones de Git</h3>
              <p>Habilitar status, diff y branches para los agentes.</p>
            </div>
            <Toggle
              label="Permitir comprobaciones Git"
              checked={draft.allowCommands}
              onChange={(value) => set('allowCommands', value)}
            />
          </div>
        </section>
        <div className="settings-save">
          <span>Las preferencias se aplican a las siguientes misiones.</span>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? <Loader2 size={14} className="spin" /> : <Save size={14} />}Guardar cambios
          </button>
        </div>
      </form>
    </>
  )
}
