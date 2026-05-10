/**
 * Internal module — owns the centralized (main) database connection.
 *
 * Only core modules (auth, oauth-service, exchange-codes) should import from here.
 * Handlers must NEVER import from internal/ — use the user-scoped services instead.
 */
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '../../db/schema/schema'
import type { DB } from '../common.db'
import { getEnv } from '../env'

const DRIZZLE_CONFIG = {
  casing: 'snake_case' as const,
}

let mainDbInstance: ReturnType<typeof drizzleLibsql> | null = null

/**
 * Returns the centralized (main) database used for auth tables
 * (users, sessions, accounts, verifications, oauth_exchange_codes).
 */
export function getMainDb(): DB {
  const env = getEnv()
  if (mainDbInstance) return mainDbInstance as unknown as DB

  const mainUrl = env.TURSO_MAIN_DB_URL

  /**
   * Remote Turso URLs use the driver's HTTP/WebSocket client.
   *
   * `file:` SQLite is used for Vitest / Node and for wrangler dev; the Workers bundle resolves
   * `@libsql/client` via the Web build (`vite.config`), which does not support `file:` — avoid
   * calling `createAuth()` (and thus opening the DB) on routes like `/health` that do not need it.
   */
  if (
    mainUrl &&
    !mainUrl.startsWith('file:') &&
    env.TURSO_MAIN_DB_AUTH_TOKEN
  ) {
    mainDbInstance = drizzleLibsql({
      connection: {
        url: mainUrl,
        authToken: env.TURSO_MAIN_DB_AUTH_TOKEN,
      },
      schema,
      ...DRIZZLE_CONFIG,
    })
    return mainDbInstance as unknown as DB
  }

  if (mainUrl?.startsWith('file:')) {
    mainDbInstance = drizzleLibsql({
      client: createClient({ url: mainUrl }),
      schema,
      ...DRIZZLE_CONFIG,
    })
    return mainDbInstance as unknown as DB
  }

  const sqliteUrl = env.SQLITE_URL || 'file:./tmp/local.db'
  mainDbInstance = drizzleLibsql({
    client: createClient({ url: sqliteUrl }),
    schema,
    ...DRIZZLE_CONFIG,
  })
  return mainDbInstance as unknown as DB
}

export const resetMainDbForTests = () => {
  mainDbInstance = null
}
