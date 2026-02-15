import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { createAuth } from '../../core/auth'
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
  deleteTagRoute,
  // Google OAuth routes (status/disconnect only - auth handled by better-auth)
  getGoogleAuthStatusRoute,
  deleteGoogleAuthRoute,
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
  googleCalendarWebhookRoute
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
  googleCalendarWebhookHandler
} from './handlers'

const app = new OpenAPIHono<AppBindings>().basePath('/api')

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
app.on(['POST', 'GET'], '/auth/*', (c) => {
  const auth = createAuth({ d1: c.env.DB })
  return auth.handler(c.req.raw)
})

// Token exchange endpoint: session token → short-lived JWT
app.post('/token', async (c) => {
  const auth = createAuth({ d1: c.env.DB })
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

// Desktop app OAuth initiation: the browser navigates here directly so that
// better-auth's state cookie is set in the browser's cookie jar (not in
// Electron's net.fetch, which has a separate cookie store).
app.get('/desktop-oauth', async (c) => {
  const provider = c.req.query('provider')
  const port = c.req.query('port')
  if (!provider || !port) {
    return c.text('Missing provider or port parameter', 400)
  }

  const url = new URL(c.req.url)
  const baseUrl = url.origin
  const callbackURL = `${baseUrl}/api/desktop-auth-callback?port=${port}`

  // Call better-auth internally to get the OAuth URL + state cookie
  const auth = createAuth({ d1: c.env.DB })
  const authResponse = await auth.handler(
    new Request(`${baseUrl}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Origin: baseUrl,
      }),
      body: JSON.stringify({ provider, callbackURL }),
    })
  )

  // Extract Set-Cookie headers (contains the OAuth state cookie)
  const setCookies = authResponse.headers.getSetCookie()

  // Get the OAuth provider URL from better-auth's response
  let oauthUrl: string | null = null
  if (authResponse.status >= 300 && authResponse.status < 400) {
    oauthUrl = authResponse.headers.get('location')
  } else if (authResponse.ok) {
    const data = (await authResponse.json()) as { url?: string }
    oauthUrl = data?.url ?? null
  }

  if (!oauthUrl) {
    return c.text('Failed to initiate OAuth', 500)
  }

  // Redirect browser to the OAuth provider, forwarding the state cookies
  const response = new Response(null, {
    status: 302,
    headers: { Location: oauthUrl },
  })
  for (const cookie of setCookies) {
    response.headers.append('Set-Cookie', cookie)
  }
  return response
})

// Desktop app OAuth callback: reads the session cookie set by better-auth and
// redirects to the Electron loopback server with the token as a query parameter.
app.get('/desktop-auth-callback', async (c) => {
  const port = c.req.query('port')
  if (!port) {
    return c.text('Missing port parameter', 400)
  }

  const cookies = c.req.header('cookie') || ''
  const match = cookies.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = match?.[1]

  if (!sessionToken) {
    return c.html(
      '<html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Authentication failed</h1><p>Session token not found. Please close this window and try again.</p></body></html>',
      401
    )
  }

  return c.redirect(
    `http://127.0.0.1:${port}/callback?session_token=${encodeURIComponent(sessionToken)}`
  )
})

// JWT auth middleware — skip public routes
app.use('/*', async (c, next) => {
  const path = c.req.path
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/webhooks') || // Google Calendar push notifications (no JWT)
    path === '/api/token' ||
    path === '/api/desktop-oauth' ||
    path === '/api/desktop-auth-callback' ||
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

// Register Google OAuth routes (status/disconnect only - auth handled by better-auth)
app.openapi(getGoogleAuthStatusRoute, getGoogleAuthStatusHandler)
app.openapi(deleteGoogleAuthRoute, deleteGoogleAuthHandler)

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

// Register webhook routes
app.openapi(googleCalendarWebhookRoute, googleCalendarWebhookHandler)

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
export default app
