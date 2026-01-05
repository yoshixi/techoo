import { drizzle as drizzleLibsql } from "drizzle-orm/libsql"
import { createClient } from "@libsql/client"
import { v7 as uuidv7 } from "uuid"
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

// Database connection - centralized for all database operations
export function getDb() {
  // Use Turso for production, SQLite for development
  if (process.env.NODE_ENV === 'production' && process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN) {
    // Production: Use Turso/libsql
    console.log('🌐 Using Turso database for production')
    return drizzleLibsql({
      connection: {
        url: process.env.TURSO_CONNECTION_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      },
      schema,
      casing: "snake_case"
    })
  } else {
    // Development: Use local SQLite
      // console.log('💾 Using local SQLite database for development')
    
    // const dbPath = getLocalDbPath()
    // return createBetterSqlite3Connection(dbPath)
    // console.error('❌ Failed to initialize SQLite database:', error)
    // console.log('🔄 Falling back to libsql client')

    const dbPath = getLocalDbPath()
    const fileUrl = `file:${dbPath}`

    try {
      return createLibsqlDrizzle(fileUrl)
    } catch (fallbackError) {
      console.error('❌ Failed to initialize libsql file database:', fallbackError)
      console.log('🧪 Falling back to libsql in-memory database')
      return createLibsqlDrizzle('file::memory:')
    }
  }
}

// Helper function to create consistent UUIDs across all database operations
export function createId(): string {
  return uuidv7()
}

// Type alias for database instance to ensure consistency
export type DB = ReturnType<typeof getDb>
