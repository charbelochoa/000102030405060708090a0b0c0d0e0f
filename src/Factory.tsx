import { useState } from 'react'
import { ArrowUpRight, Maximize2, Pause, Play, Radio } from 'lucide-react'
import { providers } from '../shared/catalog'
import { ProviderMark, SectionTitle } from './components'
import { useWorkspace } from './lib'

function Desk({
  x,
  y,
  color,
  name,
  active,
  index
}: {
  x: number
  y: number
  color: string
  name: string
  active: boolean
  index: number
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={active ? `factory-station active station-${index}` : 'factory-station'}
    >
      <ellipse cx="28" cy="53" rx="65" ry="17" fill="#000" opacity="0.15" />
      <path d="m-35 13 65-32 67 33-66 33Z" fill="#626a60" />
      <path d="M-35 13v9l66 33v-9Z" fill="#3c453d" />
      <path d="m31 46 66-32v9L31 55Z" fill="#4b574a" />
      <path d="M-24 29v26l7 4V32m96 0v26l7-4V29" fill="#343d34" />
      <path d="m13-30 37 18v30L13 0Z" fill="#303b34" stroke="#7c8e79" strokeWidth="2" />
      <path d="m17-24 29 14v22L17-2Z" fill="#18271f" />
      <path d="m21-17 16 8m-16 0 22 11m-22-5 12 6" stroke={color} strokeWidth="2" opacity="0.8" />
      <path d="m31 8 7 4v9l-7-3Z" fill="#9aab91" />
      <path d="m17 16 20-10 21 11-21 11Z" fill="#83947c" />
      <g className="pixel-agent">
        <path d="m-23-6 15-8 15 8-15 8Z" fill="#dbc3a0" />
        <path d="M-23-6v17l15 8V2Z" fill="#b89c7b" />
        <path d="M-8 2 7-6v17l-15 8Z" fill="#cdb390" />
        <path d="m-22-6 14-8 14 8-5 2-9-4-9 6Z" fill="#34372c" />
        <path d="m-24 14 16 8 15-8 5 22-20 11-21-11Z" fill={color} />
        <path d="m-21 36 8 4v20l-8-4m16-13 8-4v20l-8 4" fill="#39463c" />
        <path d="m-20 56 7 4v4l-14-7v-4m22 6 8-4 6 3-14 7Z" fill="#a5ad97" />
        <path d="m-17 1 3 1v4l-3-1m12 1 3-1v4l-3 1" fill="#202c24" />
      </g>
      <text x="25" y="91" textAnchor="middle" fill="#a4b0a3" fontSize="10" fontFamily="monospace">
        {name}
      </text>
      <circle
        className="station-light"
        cx="80"
        cy="9"
        r="3"
        fill={active ? '#b4dfaa' : '#62705f'}
      />
    </g>
  )
}

function FactoryScene({
  mini = false,
  moving = true,
  working = false
}: {
  mini?: boolean
  moving?: boolean
  working?: boolean
}) {
  return (
    <svg
      className={`factory-scene ${mini ? 'mini' : ''} ${moving ? 'moving' : ''}`}
      viewBox="0 0 740 460"
      role="img"
      aria-label="Fábrica isométrica de agentes, con cuatro estaciones de construcción, revisión, contexto y análisis"
    >
      <defs>
        <pattern
          id={mini ? 'mini-floor' : 'factory-floor'}
          width="42"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 12 21 0l21 12-21 12Z" fill="none" stroke="#444c40" strokeWidth="0.7" />
        </pattern>
      </defs>
      <path d="m45 230 326-174 323 174-323 177Z" fill="#2b332b" />
      <path
        d="m45 230 326-174 323 174-323 177Z"
        fill={`url(#${mini ? 'mini-floor' : 'factory-floor'})`}
      />
      <path d="m45 230 326 177v13L45 244Z" fill="#1f2922" />
      <path d="m371 407 323-177v14L371 420Z" fill="#253028" />
      <path d="M45 230V144L371-30v86Z" fill="#343d33" />
      <path d="M371-30 694 144v86L371 56Z" fill="#3e473a" />
      <path d="m67 154 282-150v55L67 210Z" fill="#28362b" stroke="#56634d" strokeWidth="2" />
      <path d="m91 152 233-125v29L91 181Z" fill="#829771" opacity="0.18" />
      <path d="m388 1 289 154v54L388 55Z" fill="#313b30" />
      <path
        d="m441 46 37 20v38l-37-20Zm63 34 37 20v38l-37-20Zm63 34 37 20v38l-37-20Z"
        fill="#8d9b77"
        opacity="0.35"
      />
      <path d="m297 133 75-40 75 41-75 41Z" fill="#485742" stroke="#66755c" />
      <path d="m297 133 75 42v27l-75-41Z" fill="#334330" />
      <path d="m372 175 75-41v28l-75 40Z" fill="#3e5038" />
      <path d="m347 117 26-14 25 14-26 14Z" fill="#a6bb83" />
      <path d="m347 117 25 14v25l-25-14Z" fill="#82996a" />
      <path d="m372 131 26-14v25l-26 14Z" fill="#93aa77" />
      <text
        x="371"
        y="77"
        textAnchor="middle"
        fill="#a6b597"
        fontSize="12"
        fontFamily="monospace"
        letterSpacing="5"
      >
        AERIS
      </text>
      <Desk x={215} y={190} color="#b79d7a" name="ATLAS" active={working} index={0} />
      <Desk x={420} y={190} color="#a8b991" name="NOVA" active={working} index={1} />
      <Desk x={312} y={288} color="#8c9fae" name="ORION" active={working} index={2} />
      <Desk x={520} y={288} color="#a596b4" name="VEGA" active={working} index={3} />
      <g fill="#728464">
        <path d="m98 224 13-7 13 7v28l-13 7-13-7Z" fill="#68745c" />
        <path d="m109 226-17-20 10-10 10 18-5-27 14 3-1 25 14-20 10 7-22 25Z" />
        <path d="m592 226 14-8 14 8v26l-14 8-14-8Z" fill="#68745c" />
        <path d="m603 227-16-24 12-4 9 15-3-28 13 6-2 25 14-19 9 9-23 23Z" />
      </g>
      <path
        d="m167 293 47 25m178 65 50-27"
        stroke="#a2b290"
        strokeWidth="2"
        strokeDasharray="4 5"
        opacity="0.35"
      />
    </svg>
  )
}

export function MiniFactory() {
  return <FactoryScene mini />
}

export function Factory({ onNew }: { onNew: () => void }) {
  const { snapshot } = useWorkspace()
  const [moving, setMoving] = useState(true)
  const active = snapshot?.runs.filter((r) => r.status === 'running') || []
  return (
    <>
      <SectionTitle
        eyebrow="UN EQUIPO. UN MISMO LUGAR."
        title="La fábrica"
        subtitle="Una vista espacial del trabajo que sucede en tu espacio."
      >
        <button className="button" onClick={() => setMoving((v) => !v)}>
          {moving ? <Pause size={14} /> : <Play size={14} />}
          {moving ? 'Pausar animación' : 'Activar animación'}
        </button>
        <button className="button primary" onClick={onNew}>
          Asignar una misión
          <ArrowUpRight size={14} />
        </button>
      </SectionTitle>
      <div className="factory-full panel">
        <div className="factory-status">
          <span className="live-indicator online">
            <i />
            {active.length} misiones en curso
          </span>
          <span>FÁBRICA AERIS / PLANTA 01</span>
        </div>
        <FactoryScene moving={moving} working={active.length > 0} />
        <div className="factory-caption">
          <Radio size={14} />
          {active.length
            ? 'Las estaciones animadas representan misiones en ejecución.'
            : 'Tus agentes están disponibles. Asigna una misión para poner la fábrica en movimiento.'}
        </div>
      </div>
      <div className="factory-legend">
        {providers.slice(0, 4).map((p, i) => (
          <div className="panel" key={p.id}>
            <ProviderMark provider={p.id} />
            <div>
              <strong>{['Atlas', 'Nova', 'Orion', 'Vega'][i]}</strong>
              <span>{['Construcción', 'Revisión', 'Contexto', 'Exploración'][i]}</span>
            </div>
            <span className="subtle-dot" />
          </div>
        ))}
      </div>
      <p className="view-footnote">
        Escena original de AERIS inspirada en la idea de espacios de agentes de AI Town. Las
        estaciones representan roles; el registro de misiones muestra la actividad ejecutada.
      </p>
    </>
  )
}
