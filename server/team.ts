import type { TeamTask } from '../shared/types'

export function publishTask(
  tasks: TeamTask[],
  role: TeamTask['role'],
  round: number,
  dependsOn?: string
) {
  const id = `${role}-${round}`
  const existing = tasks.find((t) => t.id === id)
  if (existing) return existing
  const task: TeamTask = { id, role, round, dependsOn, status: 'queued' }
  tasks.push(task)
  return task
}

export function claimTask(tasks: TeamTask[], role: TeamTask['role'], worker: string) {
  const task = tasks.find(
    (t) =>
      t.role === role &&
      t.status === 'queued' &&
      (!t.dependsOn ||
        tasks.some((parent) => parent.id === t.dependsOn && parent.status === 'completed'))
  )
  if (task) {
    task.status = 'running'
    task.worker = worker
  }
  return task
}

export function cancelTasks(tasks: TeamTask[], changed: (task: TeamTask) => void = () => {}) {
  for (const task of tasks.filter((t) => t.status === 'queued' || t.status === 'running')) {
    task.status = 'cancelled'
    changed(task)
  }
}

export async function workTeam(
  tasks: TeamTask[],
  workers: {
    id: string
    role: TeamTask['role']
    execute: (task: TeamTask) => Promise<void>
  }[],
  signal: AbortSignal,
  changed: (task: TeamTask) => void
) {
  try {
    while (tasks.some((t) => t.status === 'queued')) {
      signal.throwIfAborted()
      let progress = false
      for (const worker of workers) {
        const task = claimTask(tasks, worker.role, worker.id)
        if (!task) continue
        progress = true
        changed(task)
        try {
          await worker.execute(task)
          signal.throwIfAborted()
          task.status = 'completed'
        } catch (error) {
          task.status = signal.aborted ? 'cancelled' : 'failed'
          task.error = (error as Error).message
          throw error
        } finally {
          changed(task)
        }
      }
      if (!progress)
        throw new Error(
          'El tablero tiene tareas bloqueadas sin un trabajador o una dependencia disponible.'
        )
    }
  } finally {
    cancelTasks(tasks, changed)
  }
}
