import { OpenAPIHono } from '@hono/zod-openapi'
import { handle } from 'hono/vercel'
import { auth } from '../../core/auth'
import { signJwt, verifyJwt } from '../../core/jwt'
import type { AppBindings } from './types'

// Import route definitions from local routes directory
import {
  healthRoute,
  listTasksRoute,
  getTaskRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute,
  listTaskCommentsRoute,
  createTaskCommentRoute,
  getTaskCommentRoute,
  updateTaskCommentRoute,
  deleteTaskCommentRoute,
  getTaskActivitiesRoute,
  listTimersRoute,
  getTaskTimersRoute,
  getTimerRoute,
  createTimerRoute,
  updateTimerRoute,
  deleteTimerRoute,
  listTagsRoute,
  getTagRoute,
  createTagRoute,
  updateTagRoute,
  deleteTagRoute
} from './routes'

// Import handlers from local handlers directory
import {
  healthHandler,
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  listTaskCommentsHandler,
  createTaskCommentHandler,
  getTaskCommentHandler,
  updateTaskCommentHandler,
  deleteTaskCommentHandler,
  getTaskActivitiesHandler,
  listTimersHandler,
  getTaskTimersHandler,
  getTimerHandler,
  createTimerHandler,
  updateTimerHandler,
  deleteTimerHandler,
  listTagsHandler,
  getTagHandler,
  createTagHandler,
  updateTagHandler,
  deleteTagHandler
} from './handlers'

const app = new OpenAPIHono<AppBindings>().basePath('/api')

// CORS middleware — echo back the request origin so credentials mode
// 'include' (used by better-auth for cookies) is permitted by browsers.
app.use('/*', async (c, next) => {
  const origin = c.req.header('Origin')
  c.header('Access-Control-Allow-Origin', origin || '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  c.header('Access-Control-Allow-Credentials', 'true')
  c.header('Access-Control-Expose-Headers', 'set-auth-token')

  if (c.req.method === 'OPTIONS') {
    return c.text('', 200)
  }

  await next()
})

// Mount better-auth handler (sign-up, sign-in, sign-out, OAuth callbacks, etc.)
app.on(['POST', 'GET'], '/auth/**', (c) => {
  return auth.handler(c.req.raw)
})

// Token exchange endpoint: session token → short-lived JWT
app.post('/token', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const jwt = await signJwt({
    id: Number(session.user.id),
    email: session.user.email,
    name: session.user.name,
  })
  return c.json({ token: jwt })
})

// JWT auth middleware — skip public routes
app.use('/*', async (c, next) => {
  const path = c.req.path
  if (
    path.startsWith('/api/auth') ||
    path === '/api/token' ||
    path === '/api/health' ||
    path === '/api/doc'
  ) {
    return next()
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await verifyJwt(authHeader.slice(7))
    c.set('user', {
      id: Number(payload.sub),
      email: payload.email,
      name: payload.name,
    })
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

// Register health check route
app.openapi(healthRoute, healthHandler)

// Register task routes
app.openapi(listTasksRoute, listTasksHandler)
app.openapi(getTaskRoute, getTaskHandler)
app.openapi(createTaskRoute, createTaskHandler)
app.openapi(updateTaskRoute, updateTaskHandler)
app.openapi(deleteTaskRoute, deleteTaskHandler)

// Register task comment routes
app.openapi(listTaskCommentsRoute, listTaskCommentsHandler)
app.openapi(createTaskCommentRoute, createTaskCommentHandler)
app.openapi(getTaskCommentRoute, getTaskCommentHandler)
app.openapi(updateTaskCommentRoute, updateTaskCommentHandler)
app.openapi(deleteTaskCommentRoute, deleteTaskCommentHandler)

// Register task activity route
app.openapi(getTaskActivitiesRoute, getTaskActivitiesHandler)

// Register timer routes
app.openapi(listTimersRoute, listTimersHandler)
app.openapi(getTaskTimersRoute, getTaskTimersHandler)
app.openapi(getTimerRoute, getTimerHandler)
app.openapi(createTimerRoute, createTimerHandler)
app.openapi(updateTimerRoute, updateTimerHandler)
app.openapi(deleteTimerRoute, deleteTimerHandler)

// Register tag routes
app.openapi(listTagsRoute, listTagsHandler)
app.openapi(getTagRoute, getTagHandler)
app.openapi(createTagRoute, createTagHandler)
app.openapi(updateTagRoute, updateTagHandler)
app.openapi(deleteTagRoute, deleteTagHandler)

// The OpenAPI documentation will be available at /doc
app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Shuchu API',
    description: 'API for the Shuchu task management application with OpenAPI documentation'
  }
})

// Export the app for use by the OpenAPI schema generator
export { app as honoApp }

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
