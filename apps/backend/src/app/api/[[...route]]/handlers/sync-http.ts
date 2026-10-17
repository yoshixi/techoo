import type { Context } from 'hono'
import type { AppBindings } from '../types'
import { SYNC_ERROR } from '../../../core/sync.core'
import { syncDatabaseFromD1, type SyncDatabase, type SyncFailure } from '../../../core/sync.db'

const FAILURE_MESSAGE: Record<SyncFailure['code'], string> = {
  vault_not_found: 'No active vault',
  vault_exists: 'An active vault already exists',
  vault_reset: 'The active vault has changed',
  sync_conflict: 'Sync log was updated concurrently',
}

export function resolveSyncDatabase(c: Context<AppBindings>): SyncDatabase | null {
  const injected = c.get('syncDb')
  if (injected) return injected
  const d1 = c.env?.SYNC_DB
  if (!d1) return null
  return syncDatabaseFromD1(d1)
}

export function syncUnavailable(c: Context<AppBindings>) {
  return c.json({ error: 'Sync storage is not configured', code: SYNC_ERROR.unavailable }, 503)
}

export function syncErrorBody(failure: SyncFailure) {
  return { error: FAILURE_MESSAGE[failure.code], code: failure.code }
}
