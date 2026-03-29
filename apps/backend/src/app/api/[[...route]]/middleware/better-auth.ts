import type { OpenAPIHono } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import type { AppBindings, Auth } from '../types'
import { provisionTenant } from '../../../core/common.db'
import { usersTable, sessionsTable, accountsTable } from '../../../db/schema/schema'
import { getMainDb } from '../../../core/internal/main-db'

const SIGN_UP_PATHS = ['/api/auth/sign-up/email', '/api/auth/sign-in/social', '/api/auth/callback']

/**
 * Mount better-auth handler (sign-up, sign-in, sign-out, OAuth callbacks, etc.)
 * Sign-up paths are intercepted to provision the tenant DB after user creation.
 */
export function registerBetterAuthHandler(app: OpenAPIHono<AppBindings>, auth: Auth) {
  app.on(['POST', 'GET'], '/auth/*', async (c) => {
    const response = await auth.handler(c.req.raw)

    // After a successful sign-up, provision the tenant DB before returning
    // the response to the client. If provisioning fails, clean up the user
    // and return an error — the client can retry.
    if (SIGN_UP_PATHS.some((p) => c.req.path.startsWith(p)) && response.ok) {
      // Clone response to read body without consuming it
      const data = await response.clone().json().catch(() => null) as { user?: { id?: string | number; name?: string; email?: string } } | null
      const userId = data?.user?.id ? Number(data.user.id) : null

      if (userId) {
        try {
          await provisionTenant({
            id: userId,
            name: data?.user?.name || '',
            email: data?.user?.email || '',
          })
        } catch (error) {
          c.get('logger').error({ err: error, userId }, `tenant provisioning failed, rolling back user: ${error}`)
          const mainDb = getMainDb()
          await mainDb.delete(sessionsTable).where(eq(sessionsTable.userId, userId))
          await mainDb.delete(accountsTable).where(eq(accountsTable.userId, userId))
          await mainDb.delete(usersTable).where(eq(usersTable.id, userId))
          return c.json({ error: 'Account setup failed. Please try again.' }, 500)
        }
      }
    }

    return response
  })
}
