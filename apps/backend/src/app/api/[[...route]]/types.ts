import type { D1Database } from '@cloudflare/workers-types'

export type AppBindings = {
  Bindings: {
    DB: D1Database
  }
  Variables: {
    user: { id: number; email: string; name: string }
  }
}
