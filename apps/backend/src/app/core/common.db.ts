import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import fs from 'fs'
import path from 'path'
import * as schema from '../db/schema/schema'

const DRIZZLE_CONFIG = {
  casing: 'snake_case' as const,
}

let dbInstance: ReturnType<typeof drizzleLibsql> | null = null

const getEnv = (): NodeJS.ProcessEnv =>
  (typeof process === 'undefined' ? ({} as NodeJS.ProcessEnv) : process.env)
const isNodeRuntime = () => typeof process !== 'undefined' && !!process.versions?.node

const getLocalDbUrl = () => {
  if (!isNodeRuntime()) {
    throw new Error('Local SQLite file database is not supported in this runtime. Set TURSO_CONNECTION_URL/TURSO_AUTH_TOKEN instead.')
  }
  const tmpDir = path.join(process.cwd(), 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  return `file:${path.join(tmpDir, 'local.db')}`
}

const getDbFromSqlite = (url: string) =>
  drizzleLibsql({
    client: createClient({ url }),
    schema,
    ...DRIZZLE_CONFIG,
  })

export const resetDbForTests = () => {
  dbInstance = null
}

export function getDb(): DB {
  const env = getEnv()
  if (dbInstance) return dbInstance as unknown as DB

  if (env.TURSO_CONNECTION_URL && env.TURSO_AUTH_TOKEN) {
    dbInstance = drizzleLibsql({
      connection: {
        url: env.TURSO_CONNECTION_URL,
        authToken: env.TURSO_AUTH_TOKEN
      },
      schema,
      ...DRIZZLE_CONFIG
    })
    return dbInstance as unknown as DB
  }

  if (!isNodeRuntime()) {
    throw new Error('Turso credentials are required in this runtime. Set TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN.')
  }

  const url = env.SQLITE_URL || getLocalDbUrl()
  dbInstance = getDbFromSqlite(url)
  return dbInstance as unknown as DB
}

export type DB = BaseSQLiteDatabase<'async', unknown, typeof schema>
