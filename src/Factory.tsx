import { useEffect, useId, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MessageSquare,
  Pause,
  Play,
  Radio,
  RotateCcw
} from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { SectionTitle } from './components'
import { shortTime, useWorkspace } from './lib'
import type { AgentEvent, Run } from '../shared/types'

const team = [
  { name: 'Atlas', role: 'Construcción', x: 224, y: 194 },
  { name: 'Nova', role: 'Revisión', x: 664, y: 194 },
  { name: 'Orion', role: 'Contexto', x: 224, y: 366 },
  { name: 'Vega', role: 'Comunicación', x: 664, y: 366 }
]
const previewMessages = [
  'Nova, la primera versión está lista para revisar.',
  'Revisé el resultado. Falta comprobar el caso límite.',
  'Encontré la nota con el criterio de aceptación.',
  'Atlas, ya tienes la revisión y el contexto en la sala.'
]

function stationForEvent(event?: AgentEvent) {
  if (event?.type === 'reviewing') return 1
  if (event?.type === 'context.retrieved' || event?.type === 'routing') return 2
  return 0
}

function stationForSender(from: string, run?: Run) {
  const named = team.findIndex((person) => person.name.toLowerCase() === from.toLowerCase())
  if (named >= 0) return named
  if (run?.model === from) return 0
  if (run?.reviewer === from) return 1
  return 3
}

function useStudio() {
  const { snapshot, connected } = useWorkspace()
  const active = snapshot?.runs.filter((run) => ['running', 'queued'].includes(run.status)) || []
  const activeIds = new Set(active.map((run) => run.id))
  const events = (snapshot?.events || []).filter(
    (event) => event.runId && activeIds.has(event.runId) && event.type !== 'usage'
  )
  const latest = events.at(-1)
  const recent = snapshot?.messages.at(-1)
  const message = recent && Date.now() - Date.parse(recent.createdAt) < 12000 ? recent : undefined
  const candidates = message
    ? (snapshot?.runs || []).filter(
        (run) =>
          run.session === message.room &&
          message.createdAt >= run.createdAt &&
          (activeIds.has(run.id) || message.createdAt <= run.updatedAt)
      )
    : []
  const messageRun = candidates.length === 1 ? candidates[0] : undefined
  const run = message ? messageRun : active.find((item) => item.id === latest?.runId)
  const speaking = message ? stationForSender(message.from, run) : stationForEvent(latest)
  const working = team.map(
    (_, index) =>
      connected &&
      active.some(
        (item) =>
          stationForEvent(events.findLast((event) => event.runId === item.id)) === index &&
          item.status === 'running'
      )
  )
  if (connected && message) working[3] = true
  const speech =
    connected && (message || latest)
      ? {
          text: message ? message.text : latest!.text,
          source: message ? `${message.from} → ${message.to}` : `Motor · ${team[speaking].role}`,
          kind:
            run?.mode === 'demo' ? 'Misión demo' : message ? 'Mensaje de sala' : 'Evento de misión',
          speaker: speaking
        }
      : null
  const activeLabel = `${active.length} ${active.length === 1 ? 'misión' : 'misiones'} en curso`
  return { snapshot, active, activeLabel, working, speech, connected }
}

export function PixelAvatar({ index = 0, active = false }: { index?: number; active?: boolean }) {
  return (
    <svg
      className={`pixel-avatar ${active ? 'is-working' : ''}`}
      viewBox="0 0 24 28"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path d="M7 2h10v2h2v10h-2v2H7v-2H5V4h2Z" fill="var(--pixel-skin)" />
      <path
        d={
          [
            'M7 2h10v2h2v4h-4V6H9v3H5V4h2Z',
            'M7 2h10v2h2v11h-3V7H8v8H5V4h2Z',
            'M7 1h9v2h3v3h3v2H4V5h3Z',
            'M8 1h8v2h3v3h2v7h-4V7h-3V5H9v3H7v5H3V6h2V3h3Z'
          ][index]
        }
        fill="var(--pixel-ink)"
      />
      <path d="M8 10h2v2H8Zm6 0h2v2h-2Z" fill="var(--pixel-ink)" />
      <path
        d="M7 16h10v2h3v8H4v-8h3Z"
        fill={index % 2 === 0 ? 'var(--pixel-shirt)' : 'var(--pixel-shirt-alt)'}
      />
      <path d="M7 26h4v2H7Zm6 0h4v2h-4Z" fill="var(--pixel-ink)" />
      <path className="pixel-hands" d="M2 20h4v4H2Zm16 0h4v4h-4Z" fill="var(--pixel-skin)" />
      {index === 1 && (
        <path d="M7 9h5v4H7Zm6 0h5v4h-5Z" fill="none" stroke="var(--pixel-ink)" strokeWidth="1" />
      )}
      {index === 2 && (
        <path d="M8 17h2v5H8Zm6 0h2v5h-2ZM8 21h8v5H8Z" fill="var(--pixel-chair-front)" />
      )}
      {index === 3 && <path d="M2 9h4v5H2Zm16 0h4v5h-4ZM9 18h2v6H9Z" fill="var(--pixel-metal)" />}
    </svg>
  )
}

function PixelStation({
  index,
  active,
  selected
}: {
  index: number
  active: boolean
  selected: boolean
}) {
  const person = team[index]
  return (
    <g
      transform={`translate(${person.x} ${person.y})`}
      className={`pixel-station ${active ? 'is-working' : ''}`}
    >
      <rect
        x="-82"
        y="-62"
        width="164"
        height="92"
        rx="8"
        fill="var(--pixel-shadow)"
        opacity=".3"
      />
      <path d="M-88-84H88V8H-88Z" fill="var(--pixel-desk-edge)" />
      <path d="M-88-92H88V0H-88Z" fill="var(--pixel-desk)" />
      <path d="M-80 8h8v16h-8Zm152 0h8v16h-8Z" fill="var(--pixel-desk-edge)" />
      <rect x="-54" y="-118" width="108" height="62" rx="3" fill="var(--pixel-ink)" />
      <path d="M-48-112H48V-64H-48Z" fill="var(--pixel-screen)" />
      <path d="M-8-56H8v16H-8Zm-16 16H16v4H-16Z" fill="var(--pixel-metal)" />
      <g
        className="pixel-screen-lines"
        stroke="var(--pixel-code)"
        strokeWidth="3"
        opacity={active ? 1 : 0.3}
      >
        {index === 0 && <path d="M-36-100h24m6 0h19m-49 10h10m6 0h38m-54 10h31m6 0h15" />}
        {index === 1 && (
          <path
            d="M-32-76v-8m10 8v-12m10 12v-9m10 9v-18m10 18v-23m10 23v-20m10 20v-28"
            strokeWidth="5"
          />
        )}
        {index === 2 && (
          <path d="m-32-98 22 12 20-14m-20 14 10 12m-10-12-20 8m40-22 20 12" fill="none" />
        )}
        {index === 3 && <path d="M-32-99h45m-40 8h31m-36 9h51m-39 8h20" />}
        <path className="pixel-cursor" d="M18-80h7" />
      </g>
      <path d="M-33-28h66v15h-66Z" fill="var(--pixel-metal)" />
      <path
        d="M-28-23h56m-56 5h56"
        stroke="var(--pixel-desk-edge)"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <path d="M56-39h12v16H56Zm12 3h5v8h-5Z" fill="var(--pixel-paper)" />
      <path d="M-72-40h20v25h-20Z" fill="var(--pixel-paper)" />
      <path d="M-68-35h12m-12 5h9m-9 5h12" stroke="var(--pixel-metal)" strokeWidth="2" />
      <path d="M-28 20h56v32h-56Z" fill="var(--pixel-chair)" />
      <g className="pixel-person" transform="translate(-24 -8)">
        <svg width="48" height="56" viewBox="0 0 24 28">
          <PixelAvatar index={index} active={active} />
        </svg>
      </g>
      <path d="M-28 40h56v12h-56Z" fill="var(--pixel-chair-front)" />
      {selected && (
        <path
          d="M-39 39v20h78V39"
          fill="none"
          stroke="var(--pixel-selected)"
          strokeWidth="2"
          opacity=".7"
        />
      )}
    </g>
  )
}

export function PixelStudio({
  compact = false,
  moving = true,
  working = [false, false, false, false],
  selected = -1
}: {
  compact?: boolean
  moving?: boolean
  working?: boolean[]
  selected?: number
}) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      className={`pixel-studio ${compact ? 'compact' : ''} ${moving ? 'moving' : ''}`}
      viewBox="0 0 960 480"
      role="img"
      aria-label="Estudio pixel art de AERIS. Cuatro escritorios para construcción, revisión, contexto y comunicación."
      shapeRendering="crispEdges"
    >
      <defs>
        <pattern id={`floor-${id}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="var(--pixel-tile)" strokeWidth="1" />
        </pattern>
      </defs>
      <path d="M64 60H896V440H64Z" fill="var(--pixel-shadow)" />
      <path d="M64 32H896V424H64Z" fill="var(--pixel-floor)" />
      <path d="M64 88H896V424H64Z" fill={`url(#floor-${id})`} />
      <path d="M64 32H896V88H64Z" fill="var(--pixel-wall)" />
      <path d="M64 88H896v8H64Z" fill="var(--pixel-desk-edge)" />
      {[120, 640].map((x) => (
        <g key={x}>
          <path d={`M${x} 44h192v30H${x}Z`} fill="var(--pixel-window)" />
          <path d={`M${x + 64} 44v30m64-30v30`} stroke="var(--pixel-wall)" strokeWidth="4" />
        </g>
      ))}
      <text
        x="480"
        y="67"
        textAnchor="middle"
        fill="var(--pixel-sign)"
        fontSize="17"
        fontFamily="var(--mono)"
        letterSpacing="7"
        shapeRendering="auto"
      >
        AERIS
      </text>
      <path d="M408 144h144v142H408Z" fill="var(--pixel-rug)" />
      <path d="M414 150h132v130H414Z" fill="none" stroke="var(--pixel-rug-line)" strokeWidth="2" />
      <path d="M438 169h84v72h-84Z" fill="var(--pixel-desk-edge)" />
      <path d="M434 163h92v68h-92Z" fill="var(--pixel-desk)" />
      <path d="M446 172h24v30h-24Zm34 15h28v22h-28Z" fill="var(--pixel-paper)" />
      <path
        d="M450 178h16m-16 6h12m-12 6h14m34 1h14m-14 6h17"
        stroke="var(--pixel-metal)"
        strokeWidth="2"
      />
      <path d="M464 148h32v10h-32Zm0 92h32v10h-32Z" fill="var(--pixel-chair-front)" />
      {[330, 558].map((x, i) => (
        <g key={x} transform={`translate(${x} 64)`}>
          <path d="M0 0h48v39H0Z" fill="var(--pixel-desk-edge)" />
          <path d="M3 6h42v29H3Z" fill="var(--pixel-screen)" />
          <path d="M7 11h6v20H7Zm9-3h5v23h-5Zm9 5h5v18h-5Z" fill="var(--pixel-metal)" />
          <path d={i === 0 ? 'M33 9h6v22h-6Z' : 'm32 12 5-2 6 19-5 2Z'} fill="var(--pixel-paper)" />
        </g>
      ))}
      <path d="M452 318h56v66h-56Z" fill="var(--pixel-desk-edge)" />
      <path d="M448 310h64v60h-64Z" fill="var(--pixel-desk)" />
      <path d="M460 322h40v24h-40Z" fill="var(--pixel-paper)" />
      <path d="M464 328h28m-28 6h18m-18 6h24" stroke="var(--pixel-metal)" strokeWidth="2" />
      {[0, 1, 2, 3].map((index) => (
        <PixelStation
          key={index}
          index={index}
          active={working[index]}
          selected={selected === index}
        />
      ))}
      {[
        { x: 104, y: 362 },
        { x: 852, y: 180 }
      ].map(({ x, y }) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <path d="M-12 0h24v22h-24Z" fill="var(--pixel-metal)" />
          <path
            d="M-4 2v-35h8V2Zm-16-24h8v8h8v8h-8v-8h-8Zm32-8h8v16h-8v8H4v-8h8Z"
            fill="var(--pixel-plant)"
          />
        </g>
      ))}
      <g className={working.some(Boolean) ? 'pixel-transfer active' : 'pixel-transfer'}>
        <path d="M400 216h24v16h-24Z" fill="var(--pixel-paper)" />
        <path d="m400 216 12 8 12-8" fill="none" stroke="var(--pixel-ink)" strokeWidth="2" />
      </g>
      <path d="M412 414h136v10H412Z" fill="var(--pixel-metal)" />
      <path d="M432 428h96v6h-96Z" fill="var(--pixel-shadow)" />
    </svg>
  )
}

export function StudioPreview({ onOpen }: { onOpen: () => void }) {
  const { active, activeLabel, working } = useStudio()
  return (
    <button className="studio-preview" onClick={onOpen} aria-label="Abrir el estudio de agentes">
      <div className="studio-preview-copy">
        <div className="studio-preview-status">
          <i />
          {active.length ? activeLabel : 'En espera de una misión'}
        </div>
        <h2>Estudio de agentes</h2>
        <p>Sigue la construcción, la revisión y los mensajes del equipo en directo.</p>
        <span className="studio-preview-link">
          Abrir el estudio <ArrowUpRight size={15} />
        </span>
      </div>
      <div className="studio-preview-art">
        <PixelStudio compact working={working} />
      </div>
    </button>
  )
}

export function Factory({ onNew }: { onNew: () => void }) {
  const { snapshot, active, activeLabel, working, speech, connected } = useStudio()
  const [moving, setMoving] = useState(true)
  const [preview, setPreview] = useState(false)
  const [selected, setSelected] = useState(0)
  const [phase, setPhase] = useState(0)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!preview || !moving || reduce) return
    const interval = setInterval(() => setPhase((value) => (value + 1) % 4), 3400)
    return () => clearInterval(interval)
  }, [preview, moving, reduce])
  const activity = preview ? team.map((_, i) => i === phase || i === (phase + 1) % 4) : working
  const dialogue = preview
    ? {
        text: previewMessages[phase],
        speaker: phase,
        kind: 'Vista previa',
        source: team[phase].name
      }
    : speech
  const events = (snapshot?.events || [])
    .filter((event) => event.runId)
    .slice(-4)
    .reverse()
  return (
    <>
      <SectionTitle
        title="Estudio de agentes"
        subtitle="Selecciona una estación para ver qué hace el agente."
      >
        <button
          className="button"
          onClick={() => setMoving((value) => !value)}
          aria-pressed={!moving}
        >
          {moving ? <Pause size={14} /> : <Play size={14} />}
          {moving ? 'Pausar' : 'Reanudar'}
        </button>
        <button className="button primary" onClick={onNew}>
          Asignar misión
          <ArrowUpRight size={14} />
        </button>
      </SectionTitle>
      <div className="studio-layout">
        <section className="studio-room panel" aria-label="Estudio de agentes">
          <div className="studio-room-header">
            <span className="studio-room-live">
              <i />
              {preview
                ? 'Vista previa'
                : !connected
                  ? 'Conectando'
                  : active.length
                    ? activeLabel
                    : 'Estaciones disponibles'}
            </span>
            <button
              className={`studio-preview-toggle ${preview ? 'selected' : ''}`}
              onClick={() => {
                setPreview((value) => !value)
                setPhase(0)
              }}
              aria-pressed={preview}
            >
              {preview ? <RotateCcw size={13} /> : <Play size={13} />}
              {preview ? 'Volver al directo' : 'Previsualizar'}
            </button>
          </div>
          <div className={`studio-stage ${moving ? '' : 'paused'}`}>
            <PixelStudio moving={moving && !reduce} working={activity} selected={selected} />
            <div className="studio-hotspots">
              {team.map((person, index) => (
                <button
                  key={person.name}
                  className={`studio-hotspot ${selected === index ? 'selected' : ''}`}
                  style={{ left: `${(person.x + 106) / 9.6}%`, top: `${(person.y + 10) / 4.8}%` }}
                  onClick={() => setSelected(index)}
                  aria-label={`Seleccionar a ${person.name}, ${person.role}`}
                  aria-pressed={selected === index}
                >
                  <i className={activity[index] ? 'working' : ''} />
                  {person.name}
                </button>
              ))}
            </div>
            {dialogue && (
              <div
                className={`agent-speech speech-${dialogue.speaker}`}
                aria-live={preview ? 'off' : 'polite'}
                title={dialogue.text}
              >
                <span>
                  {dialogue.kind} · {dialogue.source}
                  <MessageSquare size={11} />
                </span>
                <p>
                  {dialogue.text.length > 108 ? `${dialogue.text.slice(0, 105)}…` : dialogue.text}
                </p>
                <i />
              </div>
            )}
          </div>
          <div className="studio-room-footer">
            <span>
              <Radio size={12} />
              {preview ? 'Escena de ejemplo · sin consumo de tokens' : 'Actividad del espacio'}
            </span>
            <span>{!moving ? 'Animación en pausa' : reduce ? 'Movimiento reducido' : ''}</span>
          </div>
        </section>
        <aside className="studio-inspector panel">
          <div className="studio-inspector-heading">
            <span className="eyebrow">AGENTE SELECCIONADO</span>
          </div>
          <div className="studio-portrait">
            <PixelAvatar index={selected} active={activity[selected]} />
          </div>
          <h2>{team[selected].name}</h2>
          <p>{team[selected].role}</p>
          <span className="studio-person-state">
            <i />
            {preview ? 'Previsualización' : activity[selected] ? 'Trabajando' : 'Disponible'}
          </span>
          <div className="studio-person-note">
            <span>{preview ? 'DIÁLOGO DE EJEMPLO' : 'SU PAPEL EN EL EQUIPO'}</span>
            <p>
              {preview
                ? previewMessages[selected]
                : [
                    'Da forma a una primera solución y la mejora con cada revisión.',
                    'Evalúa las propuestas y señala los detalles que se pueden mejorar.',
                    'Recupera las notas relevantes para trabajar con el contexto adecuado.',
                    'Hace visible el intercambio de mensajes entre agentes.'
                  ][selected]}
            </p>
          </div>
          <button className="button" onClick={onNew}>
            Crear una misión
            <ArrowRight size={14} />
          </button>
        </aside>
      </div>
      <div className="studio-team">
        {team.map((person, index) => (
          <button
            key={person.name}
            className={`studio-member ${selected === index ? 'selected' : ''}`}
            onClick={() => setSelected(index)}
            aria-pressed={selected === index}
          >
            <span className="studio-member-avatar">
              <PixelAvatar index={index} />
            </span>
            <span>
              <strong>{person.name}</strong>
              <small>{person.role}</small>
            </span>
            <span className="studio-member-indicator">
              {activity[index] ? <Radio size={15} /> : <Check size={14} />}
            </span>
          </button>
        ))}
      </div>
      <section className="studio-log panel">
        <div className="panel-heading">
          <h2>Actividad reciente</h2>
          <MessageSquare size={18} />
        </div>
        {events.length ? (
          events.map((event) => (
            <div className="studio-log-item" key={event.id}>
              <span>
                <i />
                <time>{shortTime(event.createdAt)}</time>
              </span>
              <p>{event.text}</p>
              <span>
                {snapshot?.runs.find((run) => run.id === event.runId)?.mode === 'demo'
                  ? 'DEMO'
                  : 'API'}
              </span>
            </div>
          ))
        ) : (
          <p className="studio-log-empty">Asigna una misión para ver sus eventos aquí.</p>
        )}
      </section>
    </>
  )
}
