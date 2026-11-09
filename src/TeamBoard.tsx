import type { TeamTask } from '../shared/types'

const states: Record<TeamTask['status'], string> = {
  queued: 'Pendiente',
  running: 'En curso',
  completed: 'Terminado',
  failed: 'Falló',
  cancelled: 'Cancelado'
}
export function TeamBoard({ tasks }: { tasks: TeamTask[] }) {
  return (
    <section className="team-board" aria-label="Tablero del equipo autónomo">
      <h3>Equipo autónomo · tablero de encargos</h3>
      {!tasks.length ? (
        <p>Sin encargos registrados.</p>
      ) : (
        <ol>
          {tasks.map((task) => (
            <li key={task.id} data-status={task.status}>
              <span>{task.dependsOn ? `Después de ${task.dependsOn}` : 'Solicitud inicial'}</span>
              <strong>
                {task.role === 'solve' ? 'Resolver' : 'Revisar'} · ronda {task.round}
              </strong>
              <span>
                {states[task.status]} · {task.worker || 'Sin asignar'}
              </span>
              <small>{task.model}</small>
              {task.error && <p role="status">{task.error}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
