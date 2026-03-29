import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { deleteAccountRoute } from '../routes/account'
import { eq } from 'drizzle-orm'
import { getTenanso, tenantNameForUser } from '../../../core/common.db'
import { getMainDb } from '../../../core/internal/main-db'
import {
  sessionsTable,
  accountsTable,
  usersTable,
} from '../../../db/schema/schema'

export const deleteAccountHandler: RouteHandler<typeof deleteAccountRoute, AppBindings> = async (c) => {
  const user = c.get('user')
  const logger = c.get('logger')

  try {
    // 1. Delete tenant database (best-effort — may not exist if provisioning failed)
    try {
      await getTenanso().deleteTenant(tenantNameForUser(user.id))
    } catch (error) {
      logger.warn({ err: error }, `tenant deletion failed (may not exist): ${error}`)
    }

    // 2. Delete user records from main database
    const mainDb = getMainDb()
    await mainDb.delete(sessionsTable).where(eq(sessionsTable.userId, user.id))
    await mainDb.delete(accountsTable).where(eq(accountsTable.userId, user.id))
    await mainDb.delete(usersTable).where(eq(usersTable.id, user.id))

    logger.info('account deleted')
    return c.json({ message: 'Account deleted' }, 200)
  } catch (error) {
    logger.error({ err: error }, `failed to delete account: ${error}`)
    return c.json({ error: 'Internal server error' }, 500)
  }
}
