import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  randomLcg,
  type SimulationNodeDatum
} from 'd3'
import MarkdownIt from 'markdown-it'
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FilePlus2,
  FileText,
  FileUp,
  GitFork,
  Hash,
  Link2,
  Loader2,
  Network,
  Pencil,
  Save,
  Search,
  Sparkles,
  X
} from 'lucide-react'
import type { ContextPage, ContextRetrieval } from '../shared/brain'
import { api, useWorkspace } from './lib'
import { Empty, ExternalLink, Modal, SectionTitle, Toggle } from './components'

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })
const preview = (content: string) =>
  markdown.render(
    content.replace(
      /\[\[([^\]\n]+)\]\]/g,
      (_, title) => `[${title.replace(/[\[\]]/g, '')}](aeris-note:${encodeURIComponent(title)})`
    )
  )
interface GraphNode extends SimulationNodeDatum {
  id: string
  pageId: string
  title: string
  connections: number
}

function ContextGraph({
  pages,
  selected,
  onSelect
}: {
  pages: ContextPage[]
  selected: string
  onSelect: (id: string) => void
}) {
  const layout = useMemo(() => {
    const nodes: GraphNode[] = pages.map((p) => ({
      id: p.title.toLowerCase(),
      pageId: p.id,
      title: p.title,
      connections: p.links.length + pages.filter((x) => x.links.includes(p.title)).length
    }))
    const ids = new Set(nodes.map((n) => n.id))
    const edges = pages.flatMap((p) =>
      p.links
        .filter((l) => ids.has(l.toLowerCase()))
        .map((l) => ({
          source: p.title.toLowerCase() as string | GraphNode,
          target: l.toLowerCase() as string | GraphNode
        }))
    )
    const simulation = forceSimulation(nodes)
      .randomSource(randomLcg(0.42))
      .force(
        'link',
        forceLink<GraphNode, (typeof edges)[number]>(edges)
          .id((n) => n.id)
          .distance(110)
      )
      .force('charge', forceManyBody().strength(-650))
      .force('center', forceCenter(360, 190))
      .force('collide', forceCollide(48))
      .stop()
    simulation.tick(180)
    nodes.forEach((n) => {
      n.x = Math.max(75, Math.min(645, n.x || 0))
      n.y = Math.max(50, Math.min(335, n.y || 0))
    })
    return { nodes, edges }
  }, [pages])
  const [offset, setOffset] = useState<Record<string, { x: number; y: number }>>({})
  const position = (n: GraphNode) => offset[n.id] || { x: n.x || 0, y: n.y || 0 }
  return (
    <div className="context-graph">
      <svg
        viewBox="0 0 720 390"
        role="img"
        aria-label={`Grafo de contexto con ${pages.length} páginas y ${layout.edges.length} enlaces`}
      >
        <defs>
          <radialGradient id="brain-light">
            <stop stopColor="#8daa9720" />
            <stop offset="1" stopColor="#8daa9700" />
          </radialGradient>
        </defs>
        <ellipse cx="360" cy="190" rx="310" ry="190" fill="url(#brain-light)" />
        {layout.edges.map((edge, i) => {
          const source = edge.source as GraphNode,
            target = edge.target as GraphNode,
            s = position(source),
            t = position(target)
          const active = source.pageId === selected || target.pageId === selected
          return (
            <line
              key={i}
              x1={s.x}
              x2={t.x}
              y1={s.y}
              y2={t.y}
              stroke={active ? '#7e9d87' : '#405648'}
              strokeWidth={active ? 1.2 : 0.7}
              opacity={active ? 0.8 : 0.45}
            />
          )
        })}
        {layout.nodes.map((node) => {
          const pos = position(node),
            active = node.pageId === selected,
            radius = 5 + Math.min(node.connections, 8) * 0.7
          return (
            <g
              key={node.id}
              transform={`translate(${pos.x} ${pos.y})`}
              role="button"
              tabIndex={0}
              aria-label={`Abrir ${node.title}`}
              className={`brain-node ${active ? 'selected' : ''}`}
              onClick={() => onSelect(node.pageId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(node.pageId)
                }
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (!e.buttons) return
                const bounds = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                setOffset((previous) => ({
                  ...previous,
                  [node.id]: {
                    x: ((e.clientX - bounds.left) / bounds.width) * 720,
                    y: ((e.clientY - bounds.top) / bounds.height) * 390
                  }
                }))
              }}
            >
              <circle
                r={radius + 9}
                fill={active ? '#a6c3b0' : '#839c8b'}
                opacity={active ? 0.09 : 0.025}
              />
              <circle
                r={radius}
                fill={active ? '#bed9c5' : '#829c89'}
                stroke={active ? '#d1e5d3' : '#9db2a2'}
                strokeWidth={active ? 1.5 : 0.5}
              />
              <text
                y={radius + 22}
                textAnchor="middle"
                fill={active ? '#c7d9c9' : '#8da393'}
                fontSize="10"
              >
                {node.title}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="graph-caption">
        <span>
          <i className="subtle-dot positive-dot" />
          {pages.length} páginas<span>·</span>
          {layout.edges.length} conexiones
        </span>
        <span>Arrastra los nodos para explorar</span>
      </div>
    </div>
  )
}

export function ContextBrain() {
  const { notify } = useWorkspace()
  const [pages, setPages] = useState<ContextPage[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [tab, setTab] = useState('graph')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [create, setCreate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [probe, setProbe] = useState(false)
  const [result, setResult] = useState<ContextRetrieval | null>(null)
  const selected = pages.find((p) => p.id === selectedId)
  const backlinks = selected
    ? pages.filter((p) => p.links.some((l) => l.toLowerCase() === selected.title.toLowerCase()))
    : []
  async function load(id?: string) {
    try {
      const data = await api<{ pages: ContextPage[] }>('/context')
      setPages(data.pages)
      setSelectedId((previous) => id || previous || data.pages[0]?.id || '')
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  useEffect(() => {
    setContent(selected?.content || '')
    setTitle(selected?.title || '')
    setEditing(false)
  }, [selectedId])
  async function save(enabled = selected?.enabled) {
    setBusy(true)
    try {
      const page = await api<ContextPage>('/context', { id: selected?.id, title, content, enabled })
      await load(page.id)
      setEditing(false)
      notify('Contexto guardado.')
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      const page = await api<ContextPage>('/context', {
        title: String(form.get('title')),
        content: '- '
      })
      await load(page.id)
      setCreate(false)
      setEditing(true)
      setContent('- ')
      setTitle(page.title)
      setTab('page')
    } catch (e) {
      notify((e as Error).message, true)
    }
  }
  async function importNotes(files: FileList | null) {
    if (!files) return
    setBusy(true)
    let count = 0
    try {
      for (const file of Array.from(files).slice(0, 50)) {
        if (file.size > 80_000 || !file.name.endsWith('.md')) continue
        const content = await file.text()
        const title =
          content.match(/^title::\s*(.+)$/m)?.[1] ||
          file.name.replace(/\.md$/, '').replaceAll('___', '/')
        await api('/context', {
          title: title.slice(0, 160),
          content: content.replace(/^title::.*\n?/m, '')
        })
        count++
      }
      await load()
      notify(`${count} páginas importadas.`)
    } catch (e) {
      await load()
      notify(`Se importaron ${count} páginas. ${(e as Error).message}`, true)
    } finally {
      setBusy(false)
    }
  }
  async function retrieve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    try {
      setResult(
        await api('/context/retrieve', {
          query: form.get('query'),
          maxTokens: Number(form.get('tokens'))
        })
      )
    } catch (e) {
      notify((e as Error).message, true)
    } finally {
      setBusy(false)
    }
  }
  function openTitle(name: string) {
    const page = pages.find((p) => p.title.toLowerCase() === name.toLowerCase())
    if (page) {
      setSelectedId(page.id)
      setTab('page')
    } else notify(`Todavía no existe la página “${name}”. Puedes crearla desde Nueva página.`)
  }
  return (
    <>
      <SectionTitle
        eyebrow="RECUERDA LO NECESARIO. CONECTA LO IMPORTANTE."
        title="Cerebro de contexto"
        subtitle="Un grafo de conocimiento para dar a tus agentes el contexto justo."
      >
        <label className="button brain-import">
          <FileUp size={13} />
          Importar Markdown
          <input
            type="file"
            accept=".md"
            multiple
            onChange={(e) => void importNotes(e.target.files)}
            disabled={busy}
          />
        </label>
        <button className="button primary" onClick={() => setCreate(true)}>
          <FilePlus2 size={14} />
          Nueva página
        </button>
      </SectionTitle>
      <div className="context-topline">
        <div className="tabs">
          <button className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')}>
            <Network size={13} />
            Grafo de conocimiento
          </button>
          <button className={tab === 'page' ? 'active' : ''} onClick={() => setTab('page')}>
            <BookOpen size={13} />
            Página
          </button>
        </div>
        <button
          className="button small-button"
          onClick={() => {
            setProbe(true)
            setResult(null)
          }}
        >
          <Sparkles size={12} />
          Probar recuperación
        </button>
      </div>
      <div className="brain-workspace panel">
        <aside className="brain-sidebar">
          <div className="brain-search">
            <Search size={13} />
            <input
              placeholder="Buscar páginas…"
              aria-label="Buscar páginas de contexto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="brain-sidebar-label">
            PÁGINAS<span>{pages.length}</span>
          </div>
          {pages
            .filter((p) =>
              `${p.title} ${p.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())
            )
            .map((p) => (
              <button
                key={p.id}
                className={`brain-page-button ${p.id === selectedId ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedId(p.id)
                  setTab('page')
                }}
              >
                <FileText size={13} />
                <span>{p.title}</span>
                <small>{p.links.length}</small>
              </button>
            ))}
          <div className="brain-sidebar-footer">
            <Network size={14} />
            <span>
              Local. Conectado.
              <br />
              Listo para recuperar.
            </span>
          </div>
        </aside>
        <div className="brain-main">
          {tab === 'graph' ? (
            <>
              <div className="brain-header">
                <div>
                  <GitFork size={14} />
                  <span>El mapa de tu conocimiento</span>
                </div>
                <span>ENLACES [[WIKI]]</span>
              </div>
              <ContextGraph
                pages={pages}
                selected={selectedId}
                onSelect={(id) => {
                  setSelectedId(id)
                  setTab('page')
                }}
              />
              <div className="brain-explanation">
                <div>
                  <h3>Ideas que se encuentran.</h3>
                  <p>
                    Conecta páginas con <code>[[Nombre de página]]</code>. Los enlaces se vuelven
                    contexto que tus agentes pueden recuperar.
                  </p>
                </div>
                <div>
                  <h3>Solo lo relevante.</h3>
                  <p>
                    La búsqueda selecciona bloques por coincidencia, etiquetas y enlaces. Hasta 1
                    800 tokens estimados por consulta del agente.
                  </p>
                </div>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="brain-header">
                <div>
                  <FileText size={14} />
                  <span>{selected.title}</span>
                </div>
                <div>
                  {editing ? (
                    <>
                      <button
                        className="link-button"
                        onClick={() => {
                          setEditing(false)
                          setContent(selected.content)
                          setTitle(selected.title)
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="button small-button"
                        disabled={busy}
                        onClick={() => void save()}
                      >
                        <Save size={12} />
                        Guardar
                      </button>
                    </>
                  ) : (
                    <button
                      className="button small-button"
                      onClick={() => {
                        setContent(selected.content)
                        setTitle(selected.title)
                        setEditing(true)
                      }}
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                  )}
                </div>
              </div>
              <div className="brain-page-content">
                {editing ? (
                  <>
                    <input
                      className="brain-title-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      aria-label="Título de página"
                      maxLength={160}
                    />
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={13}
                      maxLength={80000}
                      aria-label="Contenido Markdown"
                      placeholder="- Escribe un bloque. Conecta una [[Página]] y añade #etiquetas."
                      spellCheck={false}
                    />
                  </>
                ) : (
                  <>
                    <div className="eyebrow">PÁGINA DE CONTEXTO</div>
                    <h2>{selected.title}</h2>
                    <div className="brain-tags">
                      {selected.tags.map((tag) => (
                        <span key={tag}>
                          <Hash size={9} />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: preview(selected.content) }}
                      onClick={(e) => {
                        const anchor = (e.target as HTMLElement).closest('a')
                        const href = anchor?.getAttribute('href')
                        if (href?.startsWith('aeris-note:')) {
                          e.preventDefault()
                          openTitle(decodeURIComponent(href.slice(11)))
                        }
                      }}
                    />
                  </>
                )}
                <div className="brain-page-enabled">
                  <div>
                    <span>
                      <Sparkles size={13} />
                      Disponible para los agentes
                    </span>
                    <small>Se recuperan fragmentos relevantes, no toda la página.</small>
                  </div>
                  <Toggle
                    label="Usar esta página como contexto"
                    checked={selected.enabled}
                    onChange={(value) => void save(value)}
                  />
                </div>
                <div className="backlinks">
                  <h3>
                    <Link2 size={13} />
                    Referencias a esta página<span>{backlinks.length}</span>
                  </h3>
                  {backlinks.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setSelectedId(page.id)
                        setTab('page')
                      }}
                    >
                      <FileText size={12} />
                      {page.title}
                      <ChevronRight size={12} />
                    </button>
                  ))}
                  {!backlinks.length && (
                    <p>Las páginas que enlacen aquí aparecerán en este espacio.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <Empty
              title="Un lugar para conectar ideas"
              text="Crea una página o importa tus notas Markdown."
            />
          )}
        </div>
      </div>
      <p className="view-footnote brain-attribution">
        Modelo de páginas y bloques inspirado en{' '}
        <ExternalLink href="https://github.com/logseq/logseq">Logseq</ExternalLink>. Índice de
        enlaces con DataScript, también utilizado por Logseq. La recuperación es local y léxica; los
        tokens mostrados aquí son una estimación de contexto, separada del uso facturado.
      </p>
      <Modal
        open={create}
        onOpenChange={setCreate}
        title="Conecta una nueva idea"
        description="El título se convierte en un destino para los enlaces [[wiki]]."
      >
        <form className="mission-form" onSubmit={add}>
          <label>
            Título de página
            <input
              name="title"
              minLength={1}
              maxLength={160}
              required
              autoFocus
              placeholder="Arquitectura de mi proyecto"
            />
          </label>
          <div className="dialog-footer">
            <button className="button primary" type="submit">
              Crear página
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={probe}
        onOpenChange={setProbe}
        title="El contexto justo"
        description="Comprueba qué fragmentos recibiría un agente con este objetivo."
      >
        <form className="mission-form" onSubmit={retrieve}>
          <label>
            Consulta
            <textarea
              name="query"
              rows={3}
              required
              placeholder="Cómo reducir el coste del router sin perder calidad"
            />
          </label>
          <label>
            Presupuesto de contexto, tokens estimados
            <input name="tokens" type="number" min="80" max="8000" defaultValue="1800" />
          </label>
          <button className="button primary" disabled={busy} type="submit">
            {busy && <Loader2 size={14} className="spin" />}Recuperar contexto
            <ArrowRight size={14} />
          </button>
          {result && (
            <div className="retrieval-result">
              <strong>
                {result.hits.length} páginas · {result.estimatedTokens} / {result.maxTokens} tokens
                estimados
              </strong>
              {result.hits.map((hit) => (
                <div key={hit.pageId}>
                  <h3>
                    {hit.title}
                    <span>relevancia {hit.relevance}</span>
                  </h3>
                  <pre>{hit.excerpt}</pre>
                </div>
              ))}
              {!result.hits.length && (
                <p>No hay coincidencias relevantes. No se enviaría contexto adicional.</p>
              )}
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}
