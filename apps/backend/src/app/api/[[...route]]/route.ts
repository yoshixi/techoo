import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { createAuth } from '../../core/auth'
import { validateEnv } from '../../core/env'
import { rootLogger } from '../../lib/logger'
import type { AppBindings, Auth } from './types'

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
  deleteTagRoute,
  // Google OAuth routes (status/disconnect only - auth handled by better-auth)
  getGoogleAuthStatusRoute,
  deleteGoogleAuthRoute,
  listGoogleAccountsRoute,
  // Calendar routes
  listAvailableCalendarsRoute,
  listCalendarsRoute,
  createCalendarRoute,
  getCalendarRoute,
  updateCalendarRoute,
  deleteCalendarRoute,
  syncCalendarRoute,
  syncAllCalendarsRoute,
  // Calendar watch routes
  watchCalendarRoute,
  stopWatchingCalendarRoute,
  getWatchStatusRoute,
  // Event routes
  listEventsRoute,
  getEventRoute,
  // Webhook routes
  googleCalendarWebhookRoute,
  // Note routes
  listNotesRoute,
  getNoteRoute,
  createNoteRoute,
  updateNoteRoute,
  deleteNoteRoute,
  convertNoteToTaskRoute,
  // Auth routes
  tokenRoute,
  sessionRoute,
  sessionCodeRoute,
  // Account routes
  deleteAccountRoute,
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
  deleteTagHandler,
  // Google OAuth handlers (status/disconnect only - auth handled by better-auth)
  getGoogleAuthStatusHandler,
  deleteGoogleAuthHandler,
  listGoogleAccountsHandler,
  // Calendar handlers
  listAvailableCalendarsHandler,
  listCalendarsHandler,
  createCalendarHandler,
  getCalendarHandler,
  updateCalendarHandler,
  deleteCalendarHandler,
  syncCalendarHandler,
  syncAllCalendarsHandler,
  // Calendar watch handlers
  watchCalendarHandler,
  stopWatchingCalendarHandler,
  getWatchStatusHandler,
  // Event handlers
  listEventsHandler,
  getEventHandler,
  // Webhook handlers
  googleCalendarWebhookHandler,
  // Note handlers
  listNotesHandler,
  getNoteHandler,
  createNoteHandler,
  updateNoteHandler,
  deleteNoteHandler,
  convertNoteToTaskHandler,
  // Auth handlers
  createTokenHandler,
  createSessionHandler,
  createSessionCodeHandler,
  // Account handlers
  deleteAccountHandler,
} from './handlers'

// Import OAuth route registration (not a handler, so imported directly)
import { registerOAuthRoutes } from './handlers/oauth'

// Import middleware
import { registerLoggerMiddleware } from './middleware/logger'
import { registerBetterAuthHandler } from './middleware/better-auth'
import { registerJwtAuthMiddleware } from './middleware/jwt-auth'

export type { Auth }

export interface AppDeps {
  auth?: Auth
  skipEnvValidation?: boolean
}

export function createApp(deps?: AppDeps) {
  if (!deps?.skipEnvValidation) {
    validateEnv()
  }

  const auth = deps?.auth ?? createAuth()
  const app = new OpenAPIHono<AppBindings>().basePath('/api')

  // Logger middleware — must be first to capture all requests
  registerLoggerMiddleware(app)

  // Hono's CORS middleware sets headers on c.res after await next(),
  // so it correctly applies to all responses including raw Response
  // objects returned by auth.handler().
  app.use('/*', cors({
    origin: (origin) => origin,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['set-auth-token'],
    credentials: true,
  }))

  // Mount better-auth handler (sign-up, sign-in, sign-out, OAuth callbacks, etc.)
  registerBetterAuthHandler(app, auth)

  // Register OAuth flow routes (desktop and mobile)
  registerOAuthRoutes(app, auth)

  // JWT auth middleware — must be registered after auth/OAuth routes but before protected routes
  registerJwtAuthMiddleware(app)

  // Register auth routes (token, session, session-code)
  app.openapi(tokenRoute, createTokenHandler(auth))
  app.openapi(sessionRoute, createSessionHandler(auth))
  app.openapi(sessionCodeRoute, createSessionCodeHandler(auth))

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

  // Register Google OAuth routes (status/disconnect only - auth handled by better-auth)
  app.openapi(getGoogleAuthStatusRoute, getGoogleAuthStatusHandler)
  app.openapi(deleteGoogleAuthRoute, deleteGoogleAuthHandler)
  app.openapi(listGoogleAccountsRoute, listGoogleAccountsHandler)

  // Register calendar routes
  app.openapi(listAvailableCalendarsRoute, listAvailableCalendarsHandler)
  app.openapi(listCalendarsRoute, listCalendarsHandler)
  app.openapi(createCalendarRoute, createCalendarHandler)
  app.openapi(getCalendarRoute, getCalendarHandler)
  app.openapi(updateCalendarRoute, updateCalendarHandler)
  app.openapi(deleteCalendarRoute, deleteCalendarHandler)
  app.openapi(syncCalendarRoute, syncCalendarHandler)
  app.openapi(syncAllCalendarsRoute, syncAllCalendarsHandler)

  // Register event routes
  app.openapi(listEventsRoute, listEventsHandler)
  app.openapi(getEventRoute, getEventHandler)

  // Register calendar watch routes
  app.openapi(watchCalendarRoute, watchCalendarHandler)
  app.openapi(stopWatchingCalendarRoute, stopWatchingCalendarHandler)
  app.openapi(getWatchStatusRoute, getWatchStatusHandler)

  // Register note routes
  app.openapi(listNotesRoute, listNotesHandler)
  app.openapi(getNoteRoute, getNoteHandler)
  app.openapi(createNoteRoute, createNoteHandler)
  app.openapi(updateNoteRoute, updateNoteHandler)
  app.openapi(deleteNoteRoute, deleteNoteHandler)
  app.openapi(convertNoteToTaskRoute, convertNoteToTaskHandler)

  // Register account routes
  app.openapi(deleteAccountRoute, deleteAccountHandler)

  // Register webhook routes
  app.openapi(googleCalendarWebhookRoute, googleCalendarWebhookHandler)

  // The OpenAPI documentation will be available at /doc
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Techoo API',
      description: 'API for the Techoo task management application with OpenAPI documentation'
    }
  })

  return { app, auth }
}

// Lazy-init the default app so that importing createApp alone
// (e.g. from tests) does not trigger validateEnv().
let defaultApp: ReturnType<typeof createApp> | null = null

function getDefaultApp() {
  if (!defaultApp) {
    rootLogger.info('starting the server')
    defaultApp = createApp()
  }
  return defaultApp
}

// CF Workers requires an explicit fetch method on the default export —
// a Proxy doesn't pass the runtime's static handler check.
export default {
  fetch(request: Request, env?: Record<string, unknown>, ctx?: unknown) {
    return getDefaultApp().app.fetch(request, env, ctx as ExecutionContext)
  },
}

// Named export for the OpenAPI schema generator (needs getOpenAPIDocument etc.)
export const honoApp = new Proxy({} as ReturnType<typeof createApp>['app'], {
  get(_, prop) {
    return (getDefaultApp().app as any)[prop]
  },
})
