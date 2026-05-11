import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  createSqliteLibsqlTestContext,
  createTestUser,
  type SqliteLibsqlTestContext,
} from '../db/tests/sqliteLibsqlTestUtils'
import { todosTable } from '../db/schema/schema'
import {
  getTodosByRange,
  getIncompleteTodosInRange,
  getIncompleteTodosWithBounds,
} from './todos.db'

type TestUser = { id: number }

describe('todos.db', () => {
  let ctx: SqliteLibsqlTestContext
  let user: TestUser

  beforeAll(async () => {
    ctx = await createSqliteLibsqlTestContext()
  })

  afterAll(async () => {
    await ctx.reset()
    ctx.stop()
  })

  beforeEach(async () => {
    await ctx.reset()
    user = await createTestUser(ctx.db, 'Test User', 'test@example.com')
  })

  const insertTodo = (overrides: Partial<typeof todosTable.$inferInsert> = {}) =>
    ctx.db.insert(todosTable).values({ userId: user.id, title: 'todo', ...overrides })

  describe('getIncompleteTodosInRange', () => {
    it('includes unscheduled todos by default (scheduledOnly=false)', async () => {
      await insertTodo({ title: 'unscheduled' })
      await insertTodo({ title: 'inside range', startsAt: 250 })
      await insertTodo({ title: 'outside range', startsAt: 100 })

      const todos = await getIncompleteTodosInRange(ctx.db, user.id, 200, 300, 100)

      expect(todos.map((t) => t.title)).toEqual(['inside range', 'unscheduled'])
    })

    it('excludes unscheduled todos when scheduledOnly=true', async () => {
      await insertTodo({ title: 'unscheduled' })
      await insertTodo({ title: 'inside range', startsAt: 250 })
      await insertTodo({ title: 'outside range', startsAt: 100 })

      const todos = await getIncompleteTodosInRange(ctx.db, user.id, 200, 300, 100, true)

      expect(todos.map((t) => t.title)).toEqual(['inside range'])
    })

    it('still excludes completed todos regardless of scheduledOnly', async () => {
      await insertTodo({ title: 'done inside range', startsAt: 250, done: 1, doneAt: 260 })
      await insertTodo({ title: 'open inside range', startsAt: 250 })

      const todos = await getIncompleteTodosInRange(ctx.db, user.id, 200, 300, 100, true)

      expect(todos.map((t) => t.title)).toEqual(['open inside range'])
    })

    it('respects the half-open interval [from, to)', async () => {
      await insertTodo({ title: 'at from boundary', startsAt: 200 })
      await insertTodo({ title: 'inside range', startsAt: 250 })
      await insertTodo({ title: 'at to boundary (excluded)', startsAt: 300 })

      const todos = await getIncompleteTodosInRange(ctx.db, user.id, 200, 300, 100, true)

      expect(todos.map((t) => t.title)).toEqual(['at from boundary', 'inside range'])
    })
  })

  describe('getTodosByRange', () => {
    it('includes unscheduled todos by default when both bounds set', async () => {
      await insertTodo({ title: 'unscheduled' })
      await insertTodo({ title: 'inside range', startsAt: 250 })
      await insertTodo({ title: 'outside range', startsAt: 100 })

      const todos = await getTodosByRange(ctx.db, user.id, 200, 300, 100)

      expect(todos.map((t) => t.title)).toEqual(['inside range', 'unscheduled'])
    })

    it('excludes unscheduled todos when scheduledOnly=true', async () => {
      await insertTodo({ title: 'unscheduled' })
      await insertTodo({ title: 'inside range open', startsAt: 250 })
      await insertTodo({ title: 'inside range done', startsAt: 260, done: 1, doneAt: 270 })
      await insertTodo({ title: 'outside range', startsAt: 100 })

      const todos = await getTodosByRange(ctx.db, user.id, 200, 300, 100, true)

      expect(todos.map((t) => t.title)).toEqual(['inside range open', 'inside range done'])
    })

    it('returns both done and open scheduled todos for the range', async () => {
      await insertTodo({ title: 'open', startsAt: 250 })
      await insertTodo({ title: 'done', startsAt: 260, done: 1, doneAt: 270 })

      const todos = await getTodosByRange(ctx.db, user.id, 200, 300, 100, true)

      expect(todos.map((t) => t.title)).toEqual(['open', 'done'])
    })
  })

  describe('getIncompleteTodosWithBounds (partial bounds)', () => {
    it('does not include unscheduled todos with only a lower bound', async () => {
      await insertTodo({ title: 'unscheduled' })
      await insertTodo({ title: 'after from', startsAt: 250 })
      await insertTodo({ title: 'before from', startsAt: 100 })

      const todos = await getIncompleteTodosWithBounds(ctx.db, user.id, 200, undefined, 100)

      expect(todos.map((t) => t.title)).toEqual(['after from'])
    })

    it('does not include unscheduled todos with only an upper bound', async () => {
      await insertTodo({ title: 'unscheduled' })
      await insertTodo({ title: 'before to', startsAt: 150 })
      await insertTodo({ title: 'after to', startsAt: 350 })

      const todos = await getIncompleteTodosWithBounds(ctx.db, user.id, undefined, 300, 100)

      expect(todos.map((t) => t.title)).toEqual(['before to'])
    })
  })
})
