import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { createAuth } from '../../core/auth'
import { getEnv, validateEnv } from '../../core/env'
import { rootLogger } from '../../lib/logger'
import type { AppBindings, Auth } from './types'

// Import route definitions from local routes directory
import {
  healthRoute,
  // Todo routes
  listTodosRoute,
  createTodoRoute,
  updateTodoRoute,
  deleteTodoRoute,
  // Post routes
  listPostsRoute,
  createPostRoute,
  updatePostRoute,
  deletePostRoute,
  // Note routes
  listNotesRoute,
  getNoteRoute,
  createNoteRoute,
  updateNoteRoute,
  deleteNoteRoute,
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
  // Todo handlers
  listTodosHandler,
  createTodoHandler,
  updateTodoHandler,
  deleteTodoHandler,
  // Post handlers
  listPostsHandler,
  createPostHandler,
  updatePostHandler,
  deletePostHandler,
  // Note handlers
  listNotesHandler,
  getNoteHandler,
  createNoteHandler,
  updateNoteHandler,
  deleteNoteHandler,
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

function getAllowedCorsOrigins(): Set<string> {
  const env = getEnv()
  const allowed = new Set<string>()

  const addOrigin = (value: string | undefined) => {
    if (!value) return
    try {
      allowed.add(new URL(value).origin)
    } catch {
      rootLogger.warn({ value }, 'ignoring invalid CORS origin')
    }
  }

  addOrigin(env.BETTER_AUTH_URL)
  for (const origin of (env.TRUSTED_ORIGINS || '').split(',')) {
    addOrigin(origin.trim())
  }

  return allowed
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
  const allowedCorsOrigins = getAllowedCorsOrigins()
  app.use('/*', cors({
    origin: (origin) => {
      if (!origin) return ''

      try {
        const requestOrigin = new URL(origin).origin
        if (allowedCorsOrigins.has(requestOrigin)) {
          return requestOrigin
        }

        rootLogger.warn({ origin: requestOrigin }, 'blocked CORS origin')
        return ''
      } catch {
        rootLogger.warn({ origin }, 'blocked malformed CORS origin')
        return ''
      }
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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

  // --- v1 domain routes ---

  // Todo routes
  app.openapi(listTodosRoute, listTodosHandler)
  app.openapi(createTodoRoute, createTodoHandler)
  app.openapi(updateTodoRoute, updateTodoHandler)
  app.openapi(deleteTodoRoute, deleteTodoHandler)

  // Post routes
  app.openapi(listPostsRoute, listPostsHandler)
  app.openapi(createPostRoute, createPostHandler)
  app.openapi(updatePostRoute, updatePostHandler)
  app.openapi(deletePostRoute, deletePostHandler)

  // Note routes
  app.openapi(listNotesRoute, listNotesHandler)
  app.openapi(getNoteRoute, getNoteHandler)
  app.openapi(createNoteRoute, createNoteHandler)
  app.openapi(updateNoteRoute, updateNoteHandler)
  app.openapi(deleteNoteRoute, deleteNoteHandler)

  // --- Existing infrastructure routes ---

  // Google OAuth routes (status/disconnect only - auth handled by better-auth)
  app.openapi(getGoogleAuthStatusRoute, getGoogleAuthStatusHandler)
  app.openapi(deleteGoogleAuthRoute, deleteGoogleAuthHandler)
  app.openapi(listGoogleAccountsRoute, listGoogleAccountsHandler)

  // Calendar routes
  app.openapi(listAvailableCalendarsRoute, listAvailableCalendarsHandler)
  app.openapi(listCalendarsRoute, listCalendarsHandler)
  app.openapi(createCalendarRoute, createCalendarHandler)
  app.openapi(getCalendarRoute, getCalendarHandler)
  app.openapi(updateCalendarRoute, updateCalendarHandler)
  app.openapi(deleteCalendarRoute, deleteCalendarHandler)
  app.openapi(syncCalendarRoute, syncCalendarHandler)
  app.openapi(syncAllCalendarsRoute, syncAllCalendarsHandler)

  // Event routes
  app.openapi(listEventsRoute, listEventsHandler)
  app.openapi(getEventRoute, getEventHandler)

  // Calendar watch routes
  app.openapi(watchCalendarRoute, watchCalendarHandler)
  app.openapi(stopWatchingCalendarRoute, stopWatchingCalendarHandler)
  app.openapi(getWatchStatusRoute, getWatchStatusHandler)

  // Account routes
  app.openapi(deleteAccountRoute, deleteAccountHandler)

  // Webhook routes
  app.openapi(googleCalendarWebhookRoute, googleCalendarWebhookHandler)

  // The OpenAPI documentation will be available at /doc
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Techo API',
      description: 'API for the Techo digital planner application'
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
