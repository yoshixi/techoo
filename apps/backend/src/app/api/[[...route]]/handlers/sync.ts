import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { getSyncHeadRoute, pullSyncOpsRoute, pushSyncOpsRoute } from '../routes/sync'
import { SYNC_ERROR } from '../../../core/sync.core'
import { getSyncHead, pullOps, pushOps } from '../../../core/sync.db'
import { resolveSyncDatabase, syncErrorBody, syncUnavailable } from './sync-http'

export const getSyncHeadHandler: RouteHandler<typeof getSyncHeadRoute, AppBindings> = async (c) => {
  const db = resolveSyncDatabase(c)
  if (!db) return syncUnavailable(c)
  try {
    const result = await getSyncHead(db, c.get('user').id)
    if (!result.ok) return c.json(syncErrorBody(result), result.status)
    return c.json({ vaultId: result.vaultId, headSeq: result.headSeq, headHash: result.headHash }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to read sync head')
    return c.json({ error: 'Failed to read sync head' }, 500)
  }
}

export const pushSyncOpsHandler: RouteHandler<typeof pushSyncOpsRoute, AppBindings> = async (c) => {
  const db = resolveSyncDatabase(c)
  if (!db) return syncUnavailable(c)
  const body = c.req.valid('json')
  const ids = body.ops.map((op) => op.clientOpId)
  if (new Set(ids).size !== ids.length) {
    return c.json({
      error: 'clientOpId values must be unique within the batch',
      code: SYNC_ERROR.duplicateClientOp,
    }, 400)
  }
  try {
    const result = await pushOps(db, c.get('user').id, body.vaultId, body.ops)
    if (!result.ok) return c.json(syncErrorBody(result), result.status)
    return c.json({ ops: result.ops }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to append sync ops')
    return c.json({ error: 'Failed to append sync ops' }, 500)
  }
}

export const pullSyncOpsHandler: RouteHandler<typeof pullSyncOpsRoute, AppBindings> = async (c) => {
  const db = resolveSyncDatabase(c)
  if (!db) return syncUnavailable(c)
  const query = c.req.valid('query')
  try {
    const result = await pullOps(
      db,
      c.get('user').id,
      query.vaultId,
      query.after ?? 0,
      query.limit ?? 100,
    )
    if (!result.ok) return c.json(syncErrorBody(result), result.status)
    return c.json({ ops: result.ops, headSeq: result.headSeq }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to pull sync ops')
    return c.json({ error: 'Failed to pull sync ops' }, 500)
  }
}
