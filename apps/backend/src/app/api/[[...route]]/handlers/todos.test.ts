import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import pino from 'pino'
import type { AppBindings } from '../types'
import { listTodosRoute } from '../routes/todos'
import { listTodosHandler } from './todos'
import {
  createSqliteLibsqlTestContext,
  createTestRequest,
  createTestUser,
  type SqliteLibsqlTestContext
} from '../../../db/tests/sqliteLibsqlTestUtils'
import { todosTable } from '../../../db/schema/schema'
import type { DB } from '../../../core/common.db'
import { createOAuthService } from '../../../core/oauth.service'

type TestUser = { id: number; email: string; name: string }

const createTestApp = (getUser: () => TestUser | null, getDb: () => DB) => {
  const app = new OpenAPIHono<AppBindings>()

  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }))
    c.set('requestId', 'test-request-id')
    const user = getUser()
    if (user) {
      c.set('user', user)
      c.set('db', getDb())
      c.set('oauth', createOAuthService(user.id, getDb()))
    }
    await next()
  })

  app.openapi(listTodosRoute, listTodosHandler)

  return app
}

describe('Todo Handlers', () => {
  let testContext: SqliteLibsqlTestContext
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  let testUser: TestUser | null = null

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
    app = createTestApp(() => testUser, () => testContext.db)
    request = createTestRequest(testContext)(app)
  })

  beforeEach(async () => {
    await testContext.reset()
    const user = await createTestUser(testContext.db, 'Todo User', 'todo-user@example.com')
    testUser = { id: user.id, email: user.email, name: user.name }
  })

  afterAll(async () => {
    if (testContext) {
      await testContext.reset()
      await testContext.stop()
    }
  })

  it('applies a lower bound for open-todo queries', async () => {
    await testContext.db.insert(todosTable).values([
      {
        userId: testUser!.id,
        title: 'unscheduled open todo',
      },
      {
        userId: testUser!.id,
        title: 'before lower bound',
        startsAt: 150,
      },
      {
        userId: testUser!.id,
        title: 'inside lower bound',
        startsAt: 250,
      },
      {
        userId: testUser!.id,
        title: 'done after lower bound',
        startsAt: 350,
        done: 1,
        doneAt: 360,
      },
    ])

    const res = await request(new Request('http://localhost/v1/todos?done=false&from=200'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.map((todo: { title: string }) => todo.title)).toEqual(['inside lower bound'])
  })

  it('applies an upper bound for open-todo queries', async () => {
    await testContext.db.insert(todosTable).values([
      {
        userId: testUser!.id,
        title: 'unscheduled open todo',
      },
      {
        userId: testUser!.id,
        title: 'before upper bound',
        startsAt: 250,
      },
      {
        userId: testUser!.id,
        title: 'after upper bound',
        startsAt: 350,
      },
      {
        userId: testUser!.id,
        title: 'done before upper bound',
        startsAt: 150,
        done: 1,
        doneAt: 160,
      },
    ])

    const res = await request(new Request('http://localhost/v1/todos?done=false&to=300'))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.data.map((todo: { title: string }) => todo.title)).toEqual(['before upper bound'])
  })
})
