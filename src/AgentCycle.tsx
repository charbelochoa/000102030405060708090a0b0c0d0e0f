import { useState } from 'react'
import { ArrowDown, ArrowRight, RotateCcw } from 'lucide-react'

const stages = [
  { title: 'Solicitud y contexto', detail: 'La CLI recibe la solicitud y recupera fragmentos relevantes con un presupuesto de contexto. Los datos recuperados se tratan como datos, no como instrucciones.' },
  { title: 'Primera pasada', detail: 'Un modelo pequeño analiza el objetivo. Caveman se plantea para solicitudes de texto, Ponytail para código y una guía de prompts para preparar las instrucciones sin perder requisitos.' },
  { title: 'Router', detail: 'Selecciona modelos, APIs y tamaño del equipo según capacidades, evidencia, coste y límites. Una tarea difícil puede intentarse primero con un modelo pequeño y escalar si la verificación falla.' },
  { title: 'Orquestador', detail: 'Divide el trabajo en encargos, asigna herramientas y define dependencias, presupuesto y condiciones de parada para cada agente.' },
  { title: 'Equipo de agentes', detail: 'Los agentes colaboran y entregan resultados con evidencia. Las consultas a clientes, devoluciones o bases de datos requieren herramientas y permisos explícitos.' },
  { title: 'Verificación y supervisor', detail: 'El supervisor contrasta resultados, registra errores y decide si termina o vuelve a intentar dentro del presupuesto. Exactitud requiere respuestas de referencia; entropía cruzada requiere probabilidades y etiquetas apropiadas.' },
  { title: 'Aprendizaje validado', detail: 'Los casos y fallos pueden proponer cambios de políticas o agentes especializados. La promoción requiere validación independiente; la creación de agentes no garantiza mejora automática.' }
]

export function AgentCycle() {
  const [selected, setSelected] = useState(0)
  return (
    <section className="panel lab-panel agent-cycle">
      <header>
        <h2>Ciclo multiagente propuesto</h2>
        <span>Mapa de diseño · no es una ejecución en vivo</span>
      </header>
      <div className="agent-cycle-layout">
        <ol aria-label="Etapas del ciclo propuesto">
          {stages.map((stage, index) => (
            <li key={stage.title}>
              <button type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
                <span>{String(index + 1).padStart(2, '0')}</span>{stage.title}<ArrowRight size={14} />
              </button>
              {index < stages.length - 1 && <ArrowDown className="cycle-arrow" size={14} aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <div className="cycle-detail" aria-live="polite">
          <span>ETAPA {String(selected + 1).padStart(2, '0')}</span>
          <h3>{stages[selected].title}</h3>
          <p>{stages[selected].detail}</p>
          <div><RotateCcw size={14} /> La verificación puede iniciar otro intento con límites.</div>
          <p>Eventos simultáneos: usar claves de idempotencia y operaciones atómicas para evitar devoluciones o reembolsos duplicados.</p>
        </div>
      </div>
    </section>
  )
}
