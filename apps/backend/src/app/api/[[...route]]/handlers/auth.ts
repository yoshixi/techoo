import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings, Auth } from '../types'
import { tokenRoute, sessionRoute, sessionCodeRoute } from '../routes/auth'
import { signJwt } from '../../../core/jwt'
import { validateUserReady, provisionTenant } from '../../../core/common.db'
import { createExchangeCode, consumeExchangeCode } from '../../../core/exchange-codes'

// Helper: resolve session from Authorization header or cookie.
// Uses the bearer() plugin — pass the token via Authorization header
// so it works in both dev (HTTP) and prod (HTTPS) where cookie names differ.
async function resolveSession(auth: Auth, headers: Headers, bearerToken: string | null) {
  let session = await auth.api.getSession({ headers })
  if (!session && bearerToken) {
    const bearerHeaders = new Headers(headers)
    bearerHeaders.set('Authorization', `Bearer ${bearerToken}`)
    session = await auth.api.getSession({ headers: bearerHeaders })
  }
  return session
}

// POST /token - Exchange session/code for JWT
export function createTokenHandler(auth: Auth): RouteHandler<typeof tokenRoute, AppBindings> {
  return async (c) => {
    // If a code is provided in the body, exchange it for a session token first.
    const body = await c.req.json().catch(() => ({}))
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    let sessionToken: string | null = null

    if (code) {
      sessionToken = await consumeExchangeCode(code)
      if (!sessionToken) {
        c.get('logger').info({}, 'failed to exchange the code')
        return c.json({ error: 'Invalid or expired code' }, 400)
      }
    }

    // Resolve the session — from the exchanged token or from the Authorization header.
    const authHeader = c.req.header('Authorization')
    const bearerToken = sessionToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    const session = await resolveSession(auth, c.req.raw.headers, bearerToken)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Ensure the user's tenant DB exists before issuing a JWT.
    const userId = Number(session.user.id)
    const readiness = await validateUserReady(userId)
    if (!readiness.ok) {
      try {
        await provisionTenant({
          id: userId,
          name: session.user.name,
          email: session.user.email,
        })
      } catch (error) {
        c.get('logger').error({ err: error }, 'tenant provisioning failed at /token')
        return c.json({ error: 'Account setup failed. Please try again.' }, 503)
      }
    }

    const jwt = await signJwt({
      id: Number(session.user.id),
      email: session.user.email,
      name: session.user.name,
    })

    // When exchanging a code, also return the session token so the client can persist it.
    if (sessionToken) {
      return c.json({ token: jwt, session_token: sessionToken }, 200)
    }
    return c.json({ token: jwt }, 200)
  }
}

// GET /session - Session lookup: bearer session token → user/session data
export function createSessionHandler(auth: Auth): RouteHandler<typeof sessionRoute, AppBindings> {
  return async (c) => {
    const authHeader = c.req.header('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const session = await resolveSession(auth, c.req.raw.headers, bearerToken)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return c.json({
      user: {
        id: Number(session.user.id),
        email: session.user.email,
        name: session.user.name,
      }
    }, 200)
  }
}

// POST /session-code - Create a short-lived code tied to a session token
export function createSessionCodeHandler(auth: Auth): RouteHandler<typeof sessionCodeRoute, AppBindings> {
  return async (c) => {
    const authHeader = c.req.header('Authorization')
    const sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!sessionToken) {
      return c.json({ error: 'Missing session token' }, 400)
    }

    // Verify the session is valid before creating an exchange code
    const session = await resolveSession(auth, c.req.raw.headers, sessionToken)
    if (!session) {
      return c.json({ error: 'Invalid session token' }, 401)
    }

    const code = await createExchangeCode(sessionToken)
    return c.json({ code }, 200)
  }
}
