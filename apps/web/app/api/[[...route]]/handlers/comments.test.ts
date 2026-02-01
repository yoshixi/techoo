import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import { v7 as uuidv7 } from 'uuid'
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
import { authMiddleware } from '../middleware/auth'
import { createSqliteLibsqlTestContext, type SqliteLibsqlTestContext } from '../../../db/tests/sqliteLibsqlTestUtils'

type TestGlobal = typeof globalThis & { testDb?: SqliteLibsqlTestContext['db'] }

// Mock Clerk's verifyToken to return a test user
// Note: vi.mock is hoisted, so we use literal values here
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn().mockResolvedValue({
    sub: 'test-clerk-user-id',
    sid: 'test-session-id',
    email: 'test@example.com'
  })
}))

vi.mock('../../../core/common.db', () => ({
  getDb: () => (globalThis as TestGlobal).testDb!,
  createId: () => uuidv7()
}))

// Set CLERK_SECRET_KEY for tests so auth middleware runs normally
process.env.CLERK_SECRET_KEY = 'test-secret-key'

// Helper to create request with auth header
const createAuthRequest = (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers)
  headers.set('Authorization', 'Bearer test-token')
  return new Request(url, { ...options, headers })
}

const createTestApp = () => {
  const app = new OpenAPIHono()

  app.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*')
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (c.req.method === 'OPTIONS') {
      return c.text('', 200)
    }

    await next()
  })

  // Add auth middleware
  app.use('/*', authMiddleware)

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
  let app: OpenAPIHono
  let taskId: string

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
    ;(globalThis as TestGlobal).testDb = testContext.db
    app = createTestApp()
  })

  beforeEach(async () => {
    await testContext.reset()
    // create base task for nested comment routes
    const res = await app.request(
      createAuthRequest('http://localhost/tasks', {
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
  })

  const createComment = async (content: string) => {
    const res = await app.request(
      createAuthRequest(`http://localhost/tasks/${taskId}/comments`, {
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

    const res = await app.request(createAuthRequest(`http://localhost/tasks/${taskId}/comments`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.total).toBe(2)
    expect(data.comments[0].body).toBe('Second note')
  })

  it('updates and deletes a comment', async () => {
    const created = await createComment('Draft note')

    const updateRes = await app.request(
      createAuthRequest(`http://localhost/tasks/${taskId}/comments/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Edited note' })
      })
    )
    expect(updateRes.status).toBe(200)
    const updated = await updateRes.json()
    expect(updated.comment.body).toBe('Edited note')

    const deleteRes = await app.request(
      createAuthRequest(`http://localhost/tasks/${taskId}/comments/${created.id}`, {
        method: 'DELETE'
      })
    )
    expect(deleteRes.status).toBe(200)

    const getRes = await app.request(createAuthRequest(`http://localhost/tasks/${taskId}/comments/${created.id}`))
    expect(getRes.status).toBe(404)
  })

  it('returns combined activities sorted by timestamp', async () => {
    const now = new Date()
    await createComment('Earlier comment')
    // create timer entry
    const timerRes = await app.request(
      createAuthRequest('http://localhost/timers', {
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

    const activitiesRes = await app.request(createAuthRequest(`http://localhost/tasks/${taskId}/activities`))
    expect(activitiesRes.status).toBe(200)
    const data = await activitiesRes.json()
    expect(data.activities).toHaveLength(3)
    // newest should be latest comment
    expect(data.activities[0].type).toBe('comment')
    expect(data.activities[0].data.body).toBe('Latest comment')
  })
})
