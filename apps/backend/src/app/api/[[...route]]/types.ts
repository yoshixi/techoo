import type { Logger } from 'pino'
import type { DB } from '../../core/common.db'
import type { OAuthService } from '../../core/oauth.service'
import type { SyncDatabase } from '../../core/sync.db'
import type { createAuth } from '../../core/auth'

export type Auth = ReturnType<typeof createAuth>

export type AppBindings = {
  Bindings: {
    /** Encrypted vault and sync log. Absent until the D1 binding is provisioned. */
    SYNC_DB?: D1Database
  }
  Variables: {
    user: { id: number; email: string; name: string }
    db: DB
    oauth: OAuthService
    logger: Logger
    requestId: string
    /** Test seam. Production reads `SYNC_DB` from the worker binding. */
    syncDb?: SyncDatabase
  }
}
