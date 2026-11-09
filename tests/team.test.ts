import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cancelTasks, claimTask, publishTask, workTeam } from '../server/team'
import type { TeamTask } from '../shared/types'

test('task publication is idempotent and dependent work cannot be claimed early', () => {
  const tasks: TeamTask[] = []
  const solve = publishTask(tasks, 'solve', 1)
  assert.equal(publishTask(tasks, 'solve', 1), solve)
  publishTask(tasks, 'review', 1, solve.id)
  assert.equal(tasks.length, 2)
  assert.equal(claimTask(tasks, 'review', 'peer'), undefined)
  assert.equal(claimTask(tasks, 'solve', 'worker-a'), solve)
  assert.equal(claimTask(tasks, 'solve', 'worker-b'), undefined)
  solve.status = 'completed'
  assert.equal(claimTask(tasks, 'review', 'peer')?.worker, 'peer')
})

test('recovery cancels claimed and pending tasks while preserving finished work', () => {
  const tasks: TeamTask[] = []
  const finished = publishTask(tasks, 'solve', 1)
  finished.status = 'completed'
  publishTask(tasks, 'review', 1, finished.id)
  claimTask(tasks, 'review', 'peer')
  publishTask(tasks, 'solve', 2, 'review-1')
  cancelTasks(tasks)
  assert.deepEqual(
    tasks.map((t) => t.status),
    ['completed', 'cancelled', 'cancelled']
  )
})

test('workers publish follow-up work and a failure cancels pending tasks', async () => {
  const tasks: TeamTask[] = []
  const solve = publishTask(tasks, 'solve', 1)
  const transitions: string[] = []
  await assert.rejects(
    workTeam(
      tasks,
      [
        {
          id: 'worker',
          role: 'solve',
          execute: async (task) => {
            publishTask(tasks, 'review', 1, task.id)
          }
        },
        {
          id: 'peer',
          role: 'review',
          execute: async () => {
            publishTask(tasks, 'solve', 2)
            throw new Error('review failed')
          }
        }
      ],
      new AbortController().signal,
      (task) => {
        transitions.push(`${task.id}:${task.status}`)
      }
    ),
    /review failed/
  )
  assert.equal(solve.status, 'completed')
  assert.equal(tasks[1].status, 'failed')
  assert.equal(tasks[2].status, 'cancelled')
  assert.deepEqual(transitions, [
    'solve-1:running',
    'solve-1:completed',
    'review-1:running',
    'review-1:failed',
    'solve-2:cancelled'
  ])
})

test('unserviceable dependencies fail instead of looping and aborted tasks are cancelled', async () => {
  const tasks: TeamTask[] = []
  publishTask(tasks, 'review', 1, 'missing')
  await assert.rejects(
    workTeam(tasks, [], new AbortController().signal, () => {}),
    /bloqueadas/
  )
  assert.equal(tasks[0].status, 'cancelled')
  const cancelled: TeamTask[] = []
  publishTask(cancelled, 'solve', 1)
  const controller = new AbortController()
  await assert.rejects(
    workTeam(
      cancelled,
      [
        {
          id: 'worker',
          role: 'solve',
          execute: async () => {
            controller.abort()
          }
        }
      ],
      controller.signal,
      () => {}
    ),
    /abort/i
  )
  assert.equal(cancelled[0].status, 'cancelled')
})
