import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { verifyJwt } from '../../../core/jwt'
import { getTenantDbForUser } from '../../../core/common.db'
import { createOAuthService } from '../../../core/oauth.service'

const PUBLIC_PATHS = new Set([
  '/api/token',
  '/api/session',
  '/api/session-code',
  '/api/oauth/desktop',
  '/api/oauth/desktop/callback',
  '/api/oauth/desktop-link',
  '/api/oauth/mobile',
  '/api/oauth/mobile/callback',
  '/api/oauth/mobile-link',
  '/api/oauth/mobile-link/callback',
  '/api/health',
  '/api/doc'
])

const PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/webhooks'
]

/**
 * JWT auth middleware — skip public routes.
 * Verifies the Bearer JWT token and sets user, db, and oauth on the context.
 */
export function registerJwtAuthMiddleware(app: OpenAPIHono<AppBindings>) {
  app.use('/*', async (c, next) => {
    const path = c.req.path
    if (
      PUBLIC_PATHS.has(path) ||
      PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
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
      c.set('db', getTenantDbForUser(userId))
      c.set('oauth', createOAuthService(userId))
      await next()
    } catch {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  })
}
