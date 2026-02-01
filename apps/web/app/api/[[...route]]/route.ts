import { OpenAPIHono } from '@hono/zod-openapi'
import { handle } from 'hono/vercel'
import { authMiddleware } from './middleware/auth'

// Import route definitions from local routes directory
import {
  healthRoute,
  getAuthUrlRoute,
  exchangeTokenRoute,
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
  getAuthUrlHandler,
  exchangeTokenHandler,
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

const app = new OpenAPIHono().basePath('/api')

// Simple CORS headers middleware
app.use('/*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200)
  }
  
  await next()
})

// Register public routes (no auth required)
app.openapi(healthRoute, healthHandler)
app.openapi(getAuthUrlRoute, getAuthUrlHandler)
app.openapi(exchangeTokenRoute, exchangeTokenHandler)

// Apply auth middleware to all routes below this point
app.use('/*', authMiddleware)

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
    description: 'API for the Shuchu task management application with OpenAPI documentation. All endpoints except /health require Bearer token authentication.'
  }
})

// Export the app for use by the OpenAPI schema generator
export { app as honoApp }

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
