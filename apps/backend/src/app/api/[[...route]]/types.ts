import type { DB } from '../../core/common.db'
import type { OAuthService } from '../../core/oauth.service'
import type { createAuth } from '../../core/auth'

export type Auth = ReturnType<typeof createAuth>

export type AppBindings = {
  Bindings: {}
  Variables: {
    user: { id: number; email: string; name: string }
    db: DB
    oauth: OAuthService
  }
}
