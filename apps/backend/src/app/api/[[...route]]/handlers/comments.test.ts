import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  createTaskRoute,
  listTasksRoute
} from '../routes/tasks'
import {
  createTaskHandler,
  listTasksHandler
} from './tasks'
import {
  createTaskCommentRoute,
  listTaskCommentsRoute,
  getTaskCommentRoute,
  updateTaskCommentRoute,
  deleteTaskCommentRoute
} from '../routes/comments'
import {
  createTaskCommentHandler,
  listTaskCommentsHandler,
  getTaskCommentHandler,
  updateTaskCommentHandler,
  deleteTaskCommentHandler
} from './comments'
import { getTaskActivitiesRoute } from '../routes/activities'
import { getTaskActivitiesHandler } from './activities'
import { createTimerRoute } from '../routes/timers'
import { createTimerHandler } from './timers'
import { createSqliteLibsqlTestContext, createTestRequest, createTestUser, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils'

type TestUser = { id: number; email: string; name: string }

const createTestApp = (getUser: () => TestUser | null) => {
  const app = new OpenAPIHono<AppBindings>()

  app.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (c.req.method === 'OPTIONS') {
      return c.text('', 200)
    }

    await next()
  })

  // Inject test user context (simulates JWT auth middleware)
  app.use('/*', async (c, next) => {
    const user = getUser()
    if (user) {
      c.set('user', user)
    }
    await next()
  })

  app.openapi(createTaskRoute, createTaskHandler)
  app.openapi(listTasksRoute, listTasksHandler)
  app.openapi(createTaskCommentRoute, createTaskCommentHandler)
  app.openapi(listTaskCommentsRoute, listTaskCommentsHandler)
  app.openapi(getTaskCommentRoute, getTaskCommentHandler)
  app.openapi(updateTaskCommentRoute, updateTaskCommentHandler)
  app.openapi(deleteTaskCommentRoute, deleteTaskCommentHandler)
  app.openapi(createTimerRoute, createTimerHandler)
  app.openapi(getTaskActivitiesRoute, getTaskActivitiesHandler)

  return app
}

describe('Task comment handlers', () => {
  let testContext: SqliteLibsqlTestContext
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  let testUser: TestUser | null = null
  let taskId: number

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
    app = createTestApp(() => testUser)
    request = createTestRequest(testContext)(app)
  })

  beforeEach(async () => {
    await testContext.reset()
    const user = await createTestUser(testContext.db)
    testUser = { id: user.id, email: user.email, name: user.name }
    // create base task for nested comment routes
    const res = await request(
      new Request('http://localhost/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task with comments' })
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    taskId = body.task.id
  })

  afterAll(async () => {
    await testContext.reset()
    await testContext.stop();
  })

  const createComment = async (content: string) => {
    const res = await request(
      new Request(`http://localhost/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: content })
      })
    )
    expect(res.status).toBe(201)
    const data = await res.json()
    return data.comment
  }

  it('creates and lists task comments', async () => {
    await createComment('First note')
    await createComment('Second note')

    const res = await request(new Request(`http://localhost/tasks/${taskId}/comments`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(2)
    expect(data.comments[0].body).toBe('Second note')
  })

  it('updates and deletes a comment', async () => {
    const created = await createComment('Draft note')

    const updateRes = await request(
      new Request(`http://localhost/tasks/${taskId}/comments/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Edited note' })
      })
    )
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.comment.body).toBe('Edited note')

    const deleteRes = await request(
      new Request(`http://localhost/tasks/${taskId}/comments/${created.id}`, {
        method: 'DELETE'
      })
    )
    expect(deleteRes.status).toBe(200)

    const getRes = await request(new Request(`http://localhost/tasks/${taskId}/comments/${created.id}`))
    expect(getRes.status).toBe(404)
  })

  it('returns combined activities sorted by timestamp', async () => {
    const now = new Date()
    await createComment('Earlier comment')
    // create timer entry
    const timerRes = await request(
      new Request('http://localhost/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          startTime: now.toISOString()
        })
      })
    )
    expect(timerRes.status).toBe(201)

    await createComment('Latest comment')

    const activitiesRes = await request(new Request(`http://localhost/tasks/${taskId}/activities`))
    expect(activitiesRes.status).toBe(200)
    const data = await activitiesRes.json()
    expect(data.activities).toHaveLength(3)
    // newest should be latest comment
    expect(data.activities[0].type).toBe('comment')
    expect(data.activities[0].data.body).toBe('Latest comment')
  })
})
