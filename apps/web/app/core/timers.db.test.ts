import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest'
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from '../db/tests/sqliteLibsqlTestUtils'
import { ensureDefaultUser, createTask } from './tasks.db'
import { createTimer, getAllTimersByTaskIds } from './timers.db'

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
})
