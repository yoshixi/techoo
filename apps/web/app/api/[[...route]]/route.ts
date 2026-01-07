import { OpenAPIHono } from '@hono/zod-openapi'
import { handle } from 'hono/vercel'

// Import route definitions from local routes directory
import {
  healthRoute,
  listTasksRoute,
  getTaskRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute,
  listTimersRoute,
  getTaskTimersRoute,
  getTimerRoute,
  createTimerRoute,
  updateTimerRoute,
  deleteTimerRoute
} from './routes'

// Import handlers from local handlers directory
import {
  healthHandler,
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  listTimersHandler,
  getTaskTimersHandler,
  getTimerHandler,
  createTimerHandler,
  updateTimerHandler,
  deleteTimerHandler
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

// Register health check route
app.openapi(healthRoute, healthHandler)

// Register task routes
app.openapi(listTasksRoute, listTasksHandler)
app.openapi(getTaskRoute, getTaskHandler)
app.openapi(createTaskRoute, createTaskHandler)
app.openapi(updateTaskRoute, updateTaskHandler)
app.openapi(deleteTaskRoute, deleteTaskHandler)

// Register timer routes
app.openapi(listTimersRoute, listTimersHandler)
app.openapi(getTaskTimersRoute, getTaskTimersHandler)
app.openapi(getTimerRoute, getTimerHandler)
app.openapi(createTimerRoute, createTimerHandler)
app.openapi(updateTimerRoute, updateTimerHandler)
app.openapi(deleteTimerRoute, deleteTimerHandler)

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

console.log("API running on port 3000")