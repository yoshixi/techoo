import { drizzle as drizzleLibsql } from "drizzle-orm/libsql"
import { createClient } from "@libsql/client"
import path from "path"
import fs from "fs"
import * as schema from '../db/schema/schema';

const DRIZZLE_CONFIG = {
  casing: "snake_case" as const
}

function getLocalDbPath() {
  const tmpDir = path.join(process.cwd(), 'tmp')
  fs.mkdirSync(tmpDir, { recursive: true })
  return path.join(tmpDir, 'local.db')
}

function createLibsqlClient(url: string) {
  return createClient({
    url
  })
}

function createLibsqlDrizzle(url: string) {
  return drizzleLibsql({
    client: createLibsqlClient(url),
    schema,
    ...DRIZZLE_CONFIG
  })
}

// Database connection - centralized for all database operations (singleton)
let dbInstance: ReturnType<typeof drizzleLibsql> | null = null

export function getDb() {
  if (dbInstance) return dbInstance

  // Use Turso for production, SQLite for development
  if (process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN) {
    console.log('🌐 Using Turso database for production')
    dbInstance = drizzleLibsql({
      connection: {
        url: process.env.TURSO_CONNECTION_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      },
      schema,
      casing: "snake_case"
    })
  } else {
    const dbPath = getLocalDbPath()
    const fileUrl = `file:${dbPath}`
    console.log("use local database")

    try {
      dbInstance = createLibsqlDrizzle(fileUrl)
    } catch (fallbackError) {
      console.error('❌ Failed to initialize libsql file database:', fallbackError)
      console.log('🧪 Falling back to libsql in-memory database')
      dbInstance = createLibsqlDrizzle('file::memory:')
    }
  }

  return dbInstance!
}

// Type alias for database instance to ensure consistency
export type DB = ReturnType<typeof getDb>
