import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import d from 'datascript'
import { pageTags, wikiLinks, type ContextPage, type ContextRetrieval } from '../shared/brain'
import { data, dataDir, event, save } from './store'

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
const terms = (s: string) =>
  [...new Set(normalize(s).match(/[a-z0-9_]{3,}/g) || [])].filter(
    (t) =>
      ![
        'para',
        'como',
        'esta',
        'este',
        'estos',
        'unas',
        'unos',
        'que',
        'con',
        'por',
        'del',
        'los',
        'las',
        'the',
        'and',
        'for',
        'from',
        'this',
        'that',
        'una',
        'sin'
      ].includes(t)
  )

export function listPages(owner: string) {
  return (data.contextPages || []).filter((p) => p.owner === owner).map((p) => ({ ...p }))
}

export function savePage(
  owner: string,
  input: { id?: string; title: string; content: string; enabled?: boolean }
) {
  const title = input.title.trim()
  const pages = (data.contextPages ||= [])
  if (
    pages.some(
      (p) => p.owner === owner && normalize(p.title) === normalize(title) && p.id !== input.id
    )
  )
    throw new Error('Ya existe una página con ese título.')
  let page = input.id ? pages.find((p) => p.id === input.id && p.owner === owner) : undefined
  if (input.id && !page) throw new Error('Página no encontrada.')
  if (!page) {
    page = {
      id: randomUUID(),
      owner,
      title,
      content: '',
      tags: [],
      links: [],
      enabled: true,
      updatedAt: ''
    }
    pages.push(page)
  }
  Object.assign(page, {
    title,
    content: input.content,
    tags: pageTags(input.content),
    links: wikiLinks(input.content),
    enabled: input.enabled ?? page.enabled,
    updatedAt: new Date().toISOString()
  })
  const folder = join(dataDir, 'context', owner.replace(/[^a-zA-Z0-9_-]/g, '_'))
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, `${page.id}.md`), `title:: ${page.title}\n\n${page.content}`, 'utf8')
  event(owner, 'context', `Contexto guardado: ${title}.`)
  return page
}

export function backlinks(owner: string, title: string) {
  const pages = listPages(owner)
  const datoms: any[] = []
  pages.forEach((page, i) => {
    datoms.push([':db/add', i + 1, 'id', page.id])
    page.links.forEach((link) => datoms.push([':db/add', i + 1, 'link', normalize(link)]))
  })
  const db = d.db_with(d.empty_db({ link: { ':db/cardinality': ':db.cardinality/many' } }), datoms)
  const ids = new Set(
    d
      .q('[:find ?id :in $ ?target :where [?e "link" ?target] [?e "id" ?id]]', db, normalize(title))
      .map((row) => row[0])
  )
  return pages.filter((p) => ids.has(p.id))
}

export function retrieveContext(owner: string, query: string, maxTokens = 1800): ContextRetrieval {
  const pages = listPages(owner).filter((p) => p.enabled)
  const queryTerms = terms(query)
  const named = wikiLinks(query).map(normalize)
  const linkedIds = new Set(
    wikiLinks(query)
      .flatMap((title) => backlinks(owner, title))
      .map((p) => p.id)
  )
  const scored = pages
    .map((page) => {
      const title = normalize(page.title),
        content = normalize(page.content)
      const relevance =
        queryTerms.reduce(
          (score, term) =>
            score +
            (title.includes(term) ? 6 : 0) +
            (page.tags.some((tag) => normalize(tag).includes(term)) ? 4 : 0) +
            (content.includes(term) ? 1 : 0),
          0
        ) +
        (named.includes(title) ? 20 : 0) +
        (linkedIds.has(page.id) ? 3 : 0)
      return { page, relevance }
    })
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
  const hits: ContextRetrieval['hits'] = []
  let used = 0
  for (const { page, relevance } of scored.slice(0, 6)) {
    const remaining = maxTokens - used
    if (remaining < 80) break
    const blocks = page.content
      .split(/\n(?=- |#{1,4} )|\n\s*\n/)
      .map((block) => ({
        block,
        score: queryTerms.reduce((s, term) => s + Number(normalize(block).includes(term)), 0)
      }))
      .sort((a, b) => b.score - a.score)
    const excerpt = blocks
      .slice(0, 4)
      .map((b) => b.block)
      .join('\n')
      .slice(0, Math.min(3200, Math.max(0, remaining * 2 - page.title.length - 100)))
    const estimatedTokens = Math.ceil((page.title.length + excerpt.length + 100) / 2)
    if (estimatedTokens > remaining) continue
    hits.push({ pageId: page.id, title: page.title, excerpt, relevance, estimatedTokens })
    used += estimatedTokens
  }
  return {
    hits,
    estimatedTokens: used,
    maxTokens,
    method: 'lexical-datalog',
    text: hits
      .map(
        (h) =>
          `<context-page title=${JSON.stringify(h.title)} id="${h.pageId}">\n${h.excerpt}\n</context-page>`
      )
      .join('\n')
  }
}

export function seedContext(owner: string) {
  if (listPages(owner).length) return
  const initial = [
    [
      'AERIS',
      '- Un espacio para [[Agentes]] que resuelven problemas y mejoran con evidencia.\n- Los recursos se gestionan con [[Presupuestos]] y [[Router de modelos]].\n- Las decisiones de mejora se registran en [[Evolución]].\n\n#proyecto #aeris'
    ],
    [
      'Agentes',
      '- El constructor produce un candidato. El revisor devuelve una evaluación.\n- Ambos comparten hallazgos en una sala de colaboración.\n- Una evaluación LLM es una opinión; [[Evolución]] usa además verificaciones deterministas.\n\n#agentes #colaboracion'
    ],
    [
      'Presupuestos',
      '- Contabilizar tokens de entrada, salida y caché según usage del proveedor.\n- Reservar presupuesto antes de cada llamada.\n- Aplicar Caveman y Ponytail para respuestas concisas.\n- Consultar [[Router de modelos]] para elegir capacidad adecuada.\n\n#tokens #costes'
    ],
    [
      'Router de modelos',
      '- Elegir entre capacidad baja, media, alta y razonamiento.\n- El clasificador designado decide complejidad; se usa selección local si no está disponible.\n- Preferir el modelo configurado más económico que cumpla el nivel.\n- Respetar [[Presupuestos]].\n\n#modelos #router'
    ],
    [
      'Evolución',
      '- Comparar la política estable y una candidata con el mismo conjunto de validación.\n- Rechazar regresiones y mantener rollback.\n- Mantener el test final fuera del optimizador.\n- Las políticas de inventario sintético se evalúan sin llamadas a LLMs.\n\n#rsi #evaluacion'
    ],
    [
      'Inventario sintético',
      '- Los vehículos del simulador son datos de demostración. Precios expresados en MXN.\n- Solo mostrar vehículos disponibles. Interpretar presupuesto máximo como límite inclusivo.\n- El simulador de pagos no representa una oferta de financiamiento.\n- Ver [[Evolución]] para cambios de política.\n\n#inventario #demo'
    ]
  ]
  for (const [title, content] of initial) savePage(owner, { title, content })
}
