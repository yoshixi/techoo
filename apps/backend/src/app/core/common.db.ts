import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { D1Database } from '@cloudflare/workers-types'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import * as schema from '../db/schema/schema'

const DRIZZLE_CONFIG = {
  casing: 'snake_case' as const,
}

type DbOptions = {
  d1?: D1Database
}

let sqliteInstance: ReturnType<typeof drizzleLibsql> | null = null

const getEnv = () => (typeof process === 'undefined' ? {} : process.env)

const getDbFromSqlite = (url: string) =>
  drizzleLibsql({
    client: createClient({ url }),
    schema,
    ...DRIZZLE_CONFIG,
  })

export const resetDbForTests = () => {
  sqliteInstance = null
}

export function getDb(options: DbOptions = {}): DB {
  const env = getEnv()
  const provider = env.DB_PROVIDER || 'd1'

  if (provider === 'sqlite') {
    const url = env.SQLITE_URL || 'file::memory:?cache=shared'
    if (!sqliteInstance) {
      sqliteInstance = getDbFromSqlite(url)
    }
    return sqliteInstance as unknown as DB
  }

  if (!options.d1) {
    throw new Error('D1 binding is required when DB_PROVIDER is not sqlite')
  }

  return drizzleD1(options.d1, {
    schema,
    ...DRIZZLE_CONFIG,
  }) as unknown as DB
}

export type DB = BaseSQLiteDatabase<'async', unknown, typeof schema>
