import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { getVaultRoute, putVaultRoute, resetVaultRoute } from '../routes/vault'
import { createVault, getVault, resetVault } from '../../../core/sync.db'
import { resolveSyncDatabase, syncErrorBody, syncUnavailable } from './sync-http'

export const putVaultHandler: RouteHandler<typeof putVaultRoute, AppBindings> = async (c) => {
  const db = resolveSyncDatabase(c)
  if (!db) return syncUnavailable(c)
  try {
    const result = await createVault(db, c.get('user').id, c.req.valid('json'))
    if (!result.ok) return c.json(syncErrorBody(result), result.status)
    return c.json(result.vault, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to create sync vault')
    return c.json({ error: 'Failed to create vault' }, 500)
  }
}

export const getVaultHandler: RouteHandler<typeof getVaultRoute, AppBindings> = async (c) => {
  const db = resolveSyncDatabase(c)
  if (!db) return syncUnavailable(c)
  try {
    const result = await getVault(db, c.get('user').id)
    if (!result.ok) return c.json(syncErrorBody(result), result.status)
    return c.json(result.vault, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to read sync vault')
    return c.json({ error: 'Failed to read vault' }, 500)
  }
}

export const resetVaultHandler: RouteHandler<typeof resetVaultRoute, AppBindings> = async (c) => {
  const db = resolveSyncDatabase(c)
  if (!db) return syncUnavailable(c)
  try {
    const result = await resetVault(db, c.get('user').id, c.req.valid('json'))
    if (!result.ok) return c.json(syncErrorBody(result), result.status)
    return c.json(result.vault, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to reset sync vault')
    return c.json({ error: 'Failed to reset vault' }, 500)
  }
}
