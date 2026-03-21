import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { createAuth } from '../../core/auth'
import { signJwt, verifyJwt } from '../../core/jwt'
import { getTenantDbForUser } from '../../core/common.db'
import { createExchangeCode, consumeExchangeCode } from '../../core/exchange-codes'
import { createOAuthService } from '../../core/oauth.service'
import { validateEnv, getEnv } from '../../core/env'
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
  convertNoteToTaskRoute
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
  convertNoteToTaskHandler
} from './handlers'

export type Auth = ReturnType<typeof createAuth>

export interface AppDeps {
  auth?: Auth
  skipEnvValidation?: boolean
}

const DEFAULT_MOBILE_REDIRECT_URIS = [
  'techoo://auth-callback',
  'techoo://link-callback',
  'exp+techoo://auth-callback',
  'exp+techoo://link-callback'
]
const normalizeRedirectUri = (redirectUri: string) =>
  redirectUri.trim().replace(/\/$/, '')

const getAllowedMobileRedirectUris = () => {
  const env = getEnv()
  const raw = env.MOBILE_REDIRECT_URIS
  if (!raw) return DEFAULT_MOBILE_REDIRECT_URIS
  return raw
    .split(',')
    .map((value) => normalizeRedirectUri(value))
    .filter(Boolean)
}

const isAllowedMobileRedirectUri = (redirectUri: string) => {
  const normalized = normalizeRedirectUri(redirectUri)
  const allowed = getAllowedMobileRedirectUris()
  return allowed.includes(normalized)
}

export function createApp(deps?: AppDeps) {
  if (!deps?.skipEnvValidation) {
    validateEnv()
  }

  const auth = deps?.auth ?? createAuth()
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
  return auth.handler(c.req.raw)
})

// Token exchange endpoint.
// Accepts either:
//   - A session token via Authorization header → returns { token: JWT }
//   - A short-lived exchange code in the body → returns { token: JWT, session_token }
app.post('/token', async (c) => {

  // If a code is provided in the body, exchange it for a session token first.
  const body = await c.req.json().catch(() => ({}))
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  let sessionToken: string | null = null

  if (code) {
    sessionToken = await consumeExchangeCode(code)
    if (!sessionToken) {
      return c.json({ error: 'Invalid or expired code' }, 400)
    }
  }

  // Resolve the session — from the exchanged token or from the Authorization header.
  let session = await auth.api.getSession({ headers: c.req.raw.headers })
  const authHeader = c.req.header('Authorization')
  const bearerToken = sessionToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
  if (!session && bearerToken) {
    const headers = new Headers(c.req.raw.headers)
    headers.set('cookie', `better-auth.session_token=${bearerToken}`)
    session = await auth.api.getSession({ headers })
  }
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const jwt = await signJwt({
    id: Number(session.user.id),
    email: session.user.email,
    name: session.user.name,
  })

  // When exchanging a code, also return the session token so the client can persist it.
  if (sessionToken) {
    return c.json({ token: jwt, session_token: sessionToken })
  }
  return c.json({ token: jwt })
})

// Session lookup endpoint: bearer session token → user/session data
app.get('/session', async (c) => {

  let session = await auth.api.getSession({ headers: c.req.raw.headers })
  const authHeader = c.req.header('Authorization')
  if (!session && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const headers = new Headers(c.req.raw.headers)
    headers.set('cookie', `better-auth.session_token=${token}`)
    session = await auth.api.getSession({ headers })
  }
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({
    user: {
      id: Number(session.user.id),
      email: session.user.email,
      name: session.user.name,
    }
  })
})

// Create a short-lived code tied to a session token (used for OAuth redirects).
app.post('/session-code', async (c) => {
  const authHeader = c.req.header('Authorization')
  const sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!sessionToken) {
    return c.json({ error: 'Missing session token' }, 400)
  }
  const code = await createExchangeCode(sessionToken)
  return c.json({ code })
})


// Desktop app OAuth initiation: the browser navigates here directly so that
// better-auth's state cookie is set in the browser's cookie jar (not in
// Electron's net.fetch, which has a separate cookie store).
app.get('/oauth/desktop', async (c) => {
  const provider = c.req.query('provider')
  const port = c.req.query('port')
  if (!provider || !port) {
    return c.text('Missing provider or port parameter', 400)
  }

  const url = new URL(c.req.url)
  const baseUrl = url.origin
  const callbackURL = `${baseUrl}/api/oauth/desktop/callback?port=${port}`

  // Call better-auth handler in-process (no network hop) to generate the OAuth
  // URL and set the state cookie on the browser response.

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
// redirects to the Electron loopback server with a short-lived code.
app.get('/oauth/desktop/callback', async (c) => {
  const port = c.req.query('port')
  if (!port) {
    return c.text('Missing port parameter', 400)
  }

  const cookies = c.req.header('cookie') || ''
  const match = cookies.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = match?.[1] || undefined

  if (!sessionToken) {
    return c.html(
      '<html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Authentication failed</h1><p>Session token not found. Please close this window and try again.</p></body></html>',
      401
    )
  }

  const code = await createExchangeCode(sessionToken)
  return c.redirect(
    `http://127.0.0.1:${port}/callback?code=${encodeURIComponent(code)}`
  )
})

// Desktop app account linking initiation: ensures OAuth state cookie is set in the browser.
app.get('/oauth/desktop-link', async (c) => {
  const provider = c.req.query('provider')
  const port = c.req.query('port')
  const sessionCode = c.req.query('session_code')
  if (!provider || !port || !sessionCode) {
    return c.text('Missing provider, port, or session code', 400)
  }

  const sessionToken = await consumeExchangeCode(sessionCode)
  if (!sessionToken) {
    return c.text('Invalid or expired session code', 401)
  }

  const url = new URL(c.req.url)
  const baseUrl = url.origin
  const callbackURL = `http://127.0.0.1:${port}/callback?linked=1`


  const authResponse = await auth.handler(
    new Request(`${baseUrl}/api/auth/link-social`, {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Authorization: `Bearer ${sessionToken}`
      }),
      body: JSON.stringify({ provider, callbackURL, disableRedirect: true })
    })
  )

  const setCookies = authResponse.headers.getSetCookie()

  let oauthUrl: string | null = null
  if (authResponse.ok) {
    const data = (await authResponse.json()) as { url?: string }
    oauthUrl = data?.url ?? null
  }

  if (!oauthUrl) {
    return c.text('Failed to initiate link flow', 500)
  }

  const response = new Response(null, {
    status: 302,
    headers: { Location: oauthUrl }
  })
  for (const cookie of setCookies) {
    response.headers.append('Set-Cookie', cookie)
  }
  return response
})

// Mobile app OAuth initiation: same pattern as desktop but uses deep link redirect
app.get('/oauth/mobile', async (c) => {
  const provider = c.req.query('provider')
  const redirectUri = c.req.query('redirect_uri')
  if (!provider || !redirectUri) {
    return c.text('Missing provider or redirect_uri parameter', 400)
  }
  if (!isAllowedMobileRedirectUri(redirectUri)) {
    return c.text('Untrusted redirect_uri parameter', 400)
  }

  const url = new URL(c.req.url)
  const baseUrl = url.origin
  const callbackURL = `${baseUrl}/api/oauth/mobile/callback?redirect_uri=${encodeURIComponent(redirectUri)}`


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

  const setCookies = authResponse.headers.getSetCookie()

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

  const response = new Response(null, {
    status: 302,
    headers: { Location: oauthUrl },
  })
  for (const cookie of setCookies) {
    response.headers.append('Set-Cookie', cookie)
  }
  return response
})

// Mobile app OAuth callback: reads session cookie and redirects to deep link
app.get('/oauth/mobile/callback', async (c) => {
  const redirectUri = c.req.query('redirect_uri')
  if (!redirectUri) {
    return c.text('Missing redirect_uri parameter', 400)
  }
  if (!isAllowedMobileRedirectUri(redirectUri)) {
    return c.text('Untrusted redirect_uri parameter', 400)
  }

  const cookies = c.req.header('cookie') || ''
  const match = cookies.match(/better-auth\.session_token=([^;]+)/)
  const sessionToken = match?.[1] || undefined

  if (!sessionToken) {
    return c.html(
      '<html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Authentication failed</h1><p>Session token not found. Please close this window and try again.</p></body></html>',
      401
    )
  }

  const separator = redirectUri.includes('?') ? '&' : '?'
  const code = await createExchangeCode(sessionToken)
  return c.redirect(
    `${redirectUri}${separator}code=${encodeURIComponent(code)}`
  )
})

// Mobile app account linking initiation: same as desktop-link but uses deep link redirect
app.get('/oauth/mobile-link', async (c) => {
  const provider = c.req.query('provider')
  const redirectUri = c.req.query('redirect_uri')
  const sessionCode = c.req.query('session_code')
  if (!provider || !redirectUri || !sessionCode) {
    return c.text('Missing provider, redirect_uri, or session_code parameter', 400)
  }
  if (!isAllowedMobileRedirectUri(redirectUri)) {
    return c.text('Untrusted redirect_uri parameter', 400)
  }

  const sessionToken = await consumeExchangeCode(sessionCode)
  if (!sessionToken) {
    return c.text('Invalid or expired session code', 401)
  }

  const url = new URL(c.req.url)
  const baseUrl = url.origin
  const callbackURL = `${baseUrl}/api/oauth/mobile-link/callback?redirect_uri=${encodeURIComponent(redirectUri)}`


  const authResponse = await auth.handler(
    new Request(`${baseUrl}/api/auth/link-social`, {
      method: 'POST',
      headers: new Headers({
        'Content-Type': 'application/json',
        Origin: baseUrl,
        Authorization: `Bearer ${sessionToken}`
      }),
      body: JSON.stringify({ provider, callbackURL, disableRedirect: true })
    })
  )

  const setCookies = authResponse.headers.getSetCookie()

  let oauthUrl: string | null = null
  if (authResponse.ok) {
    const data = (await authResponse.json()) as { url?: string }
    oauthUrl = data?.url ?? null
  }

  if (!oauthUrl) {
    return c.text('Failed to initiate link flow', 500)
  }

  const response = new Response(null, {
    status: 302,
    headers: { Location: oauthUrl }
  })
  for (const cookie of setCookies) {
    response.headers.append('Set-Cookie', cookie)
  }
  return response
})

// Mobile app account linking callback: reads session cookie and redirects to deep link
app.get('/oauth/mobile-link/callback', async (c) => {
  const redirectUri = c.req.query('redirect_uri')
  if (!redirectUri) {
    return c.text('Missing redirect_uri parameter', 400)
  }
  if (!isAllowedMobileRedirectUri(redirectUri)) {
    return c.text('Untrusted redirect_uri parameter', 400)
  }

  const separator = redirectUri.includes('?') ? '&' : '?'
  return c.redirect(`${redirectUri}${separator}linked=1`)
})
// JWT auth middleware — skip public routes
app.use('/*', async (c, next) => {
  const path = c.req.path
  if (
    path.startsWith('/api/auth') ||
    path.startsWith('/api/webhooks') || // Google Calendar push notifications (no JWT)
    path === '/api/token' ||
    path === '/api/session' ||
    path === '/api/session-code' ||
    path === '/api/oauth/desktop' ||
    path === '/api/oauth/desktop/callback' ||
    path === '/api/oauth/desktop-link' ||
    path === '/api/oauth/mobile' ||
    path === '/api/oauth/mobile/callback' ||
    path === '/api/oauth/mobile-link' ||
    path === '/api/oauth/mobile-link/callback' ||
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
    const userId = Number(payload.sub)
    c.set('user', {
      id: userId,
      email: payload.email,
      name: payload.name,
    })
    // Set the tenant database for this user
    c.set('db', getTenantDbForUser(userId))
    // Set user-scoped OAuth service
    c.set('oauth', createOAuthService(userId))
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
    console.log('starting the server')
    defaultApp = createApp()
  }
  return defaultApp
}

// Export the app for use by the OpenAPI schema generator and Next.js runtime
export const honoApp = new Proxy({} as ReturnType<typeof createApp>['app'], {
  get(_, prop) {
    return (getDefaultApp().app as any)[prop]
  },
})

export default honoApp
