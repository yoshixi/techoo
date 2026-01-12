import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest'
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from '../db/tests/sqliteLibsqlTestUtils'
import { ensureDefaultUser, createTask } from './tasks.db'
import { createTimer, getAllTimersByTaskIds, stopActiveTimersForTask, updateTimer, getTimersByTaskId } from './timers.db'

describe('timers.db', () => {
  let testContext: SqliteLibsqlTestContext

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
  })

  beforeEach(async () => {
    await testContext.reset()
  })

  afterAll(async () => {
    if (testContext) {
      await testContext.reset()
    }
  })

  it('returns timers only for the requested task ids', async () => {
    const db = testContext.db
    const user = await ensureDefaultUser(db)

    const taskA = await createTask(db, user.id.toString(), {
      title: 'Task A'
    })
    const taskB = await createTask(db, user.id.toString(), {
      title: 'Task B'
    })

    await createTimer(db, user.id.toString(), {
      taskId: taskA.id,
      startTime: new Date('2024-01-01T10:00:00.000Z').toISOString()
    })
    await createTimer(db, user.id.toString(), {
      taskId: taskB.id,
      startTime: new Date('2024-01-01T11:00:00.000Z').toISOString()
    })
    await createTimer(db, user.id.toString(), {
      taskId: taskA.id,
      startTime: new Date('2024-01-01T12:00:00.000Z').toISOString()
    })

    const result = await getAllTimersByTaskIds(db, [taskA.id])
    expect(result).toHaveLength(2)
    expect(result.every((timer) => timer.taskId === taskA.id)).toBe(true)
  })

  it('returns timers for multiple task ids', async () => {
    const db = testContext.db
    const user = await ensureDefaultUser(db)

    const taskA = await createTask(db, user.id.toString(), {
      title: 'Task A'
    })
    const taskB = await createTask(db, user.id.toString(), {
      title: 'Task B'
    })

    await createTimer(db, user.id.toString(), {
      taskId: taskA.id,
      startTime: new Date('2024-01-01T10:00:00.000Z').toISOString()
    })
    await createTimer(db, user.id.toString(), {
      taskId: taskB.id,
      startTime: new Date('2024-01-01T11:00:00.000Z').toISOString()
    })

    const result = await getAllTimersByTaskIds(db, [taskA.id, taskB.id])
    expect(result).toHaveLength(2)
    const taskIds = new Set(result.map((timer) => timer.taskId))
    expect(taskIds.has(taskA.id)).toBe(true)
    expect(taskIds.has(taskB.id)).toBe(true)
  })

  describe('stopActiveTimersForTask', () => {
    it('stops all active timers for a task', async () => {
      const db = testContext.db
      const user = await ensureDefaultUser(db)

      const task = await createTask(db, user.id.toString(), {
        title: 'Task with active timers'
      })

      // Create two active timers (no endTime)
      await createTimer(db, user.id.toString(), {
        taskId: task.id,
        startTime: new Date('2024-01-01T10:00:00.000Z').toISOString()
      })
      await createTimer(db, user.id.toString(), {
        taskId: task.id,
        startTime: new Date('2024-01-01T11:00:00.000Z').toISOString()
      })

      // Verify both timers are active (endTime is null)
      const timersBefore = await getTimersByTaskId(db, user.id.toString(), task.id)
      expect(timersBefore).toHaveLength(2)
      expect(timersBefore!.every((t) => t.endTime === null)).toBe(true)

      // Stop active timers
      const stoppedCount = await stopActiveTimersForTask(db, task.id)
      expect(stoppedCount).toBe(2)

      // Verify all timers are now stopped (endTime is not null)
      const timersAfter = await getTimersByTaskId(db, user.id.toString(), task.id)
      expect(timersAfter).toHaveLength(2)
      expect(timersAfter!.every((t) => t.endTime !== null)).toBe(true)
    })

    it('does not affect already stopped timers', async () => {
      const db = testContext.db
      const user = await ensureDefaultUser(db)

      const task = await createTask(db, user.id.toString(), {
        title: 'Task with mixed timers'
      })

      // Create one active timer
      await createTimer(db, user.id.toString(), {
        taskId: task.id,
        startTime: new Date('2024-01-01T10:00:00.000Z').toISOString()
      })

      // Create one stopped timer
      const stoppedTimer = await createTimer(db, user.id.toString(), {
        taskId: task.id,
        startTime: new Date('2024-01-01T11:00:00.000Z').toISOString()
      })
      await updateTimer(db, stoppedTimer!.id, {
        endTime: new Date('2024-01-01T12:00:00.000Z').toISOString()
      })

      // Stop active timers - should only stop 1
      const stoppedCount = await stopActiveTimersForTask(db, task.id)
      expect(stoppedCount).toBe(1)

      // Verify all timers are now stopped
      const timersAfter = await getTimersByTaskId(db, user.id.toString(), task.id)
      expect(timersAfter).toHaveLength(2)
      expect(timersAfter!.every((t) => t.endTime !== null)).toBe(true)
    })

    it('returns 0 when no active timers exist', async () => {
      const db = testContext.db
      const user = await ensureDefaultUser(db)

      const task = await createTask(db, user.id.toString(), {
        title: 'Task with no timers'
      })

      const stoppedCount = await stopActiveTimersForTask(db, task.id)
      expect(stoppedCount).toBe(0)
    })

    it('only stops timers for the specified task', async () => {
      const db = testContext.db
      const user = await ensureDefaultUser(db)

      const taskA = await createTask(db, user.id.toString(), {
        title: 'Task A'
      })
      const taskB = await createTask(db, user.id.toString(), {
        title: 'Task B'
      })

      // Create active timer for each task
      await createTimer(db, user.id.toString(), {
        taskId: taskA.id,
        startTime: new Date('2024-01-01T10:00:00.000Z').toISOString()
      })
      await createTimer(db, user.id.toString(), {
        taskId: taskB.id,
        startTime: new Date('2024-01-01T11:00:00.000Z').toISOString()
      })

      // Stop only Task A's timers
      const stoppedCount = await stopActiveTimersForTask(db, taskA.id)
      expect(stoppedCount).toBe(1)

      // Task A's timer should be stopped
      const taskATimers = await getTimersByTaskId(db, user.id.toString(), taskA.id)
      expect(taskATimers).not.toBeNull()
      expect(taskATimers!.length).toBeGreaterThan(0)
      expect(taskATimers![0]!.endTime).not.toBeNull()

      // Task B's timer should still be active
      const taskBTimers = await getTimersByTaskId(db, user.id.toString(), taskB.id)
      expect(taskBTimers).not.toBeNull()
      expect(taskBTimers!.length).toBeGreaterThan(0)
      expect(taskBTimers![0]!.endTime).toBeNull()
    })
  })
})
