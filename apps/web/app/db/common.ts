import { drizzle } from "drizzle-orm/better-sqlite3"
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql"
import Database from "better-sqlite3"
import { v7 as uuidv7 } from "uuid"
import path from "path"
import fs from "fs"

// Database connection - centralized for all database operations 
// TODO: Remove this function and use the getDb function from the core/common.db.ts file
// this function is used to make a type alias for the database instance to ensure consistency
export function getDb() {
  // Use Turso for production, SQLite for development
  console.warn("DEPRECATED: Use the getDb function from the core/common.db.ts file instead")
  if (process.env.NODE_ENV === 'production' && process.env.TURSO_CONNECTION_URL && process.env.TURSO_AUTH_TOKEN) {
    // Production: Use Turso/libsql
    return drizzleLibsql({
      connection: {
        url: process.env.TURSO_CONNECTION_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      },
      casing: "snake_case"
    })
  } else {
    // Development: Use local SQLite
    const tmpDir = path.join(process.cwd(), 'tmp')
    fs.mkdirSync(tmpDir, { recursive: true })
    const dbPath = path.join(tmpDir, 'local.db')
    
    const sqlite = new Database(dbPath)
    
    // Enable foreign keys and other optimizations
    sqlite.pragma('foreign_keys = ON')
    sqlite.pragma('journal_mode = WAL')
    
    return drizzle(sqlite, {
      casing: "snake_case"
    })
  }
}

// Helper function to create consistent UUIDs across all database operations
export function createId(): string {
  return uuidv7()
}

// Type alias for database instance to ensure consistency
export type DB = ReturnType<typeof getDb>
