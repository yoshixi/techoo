import type { D1Database } from '@cloudflare/workers-types'
import { getDb as getCoreDb, type DB as CoreDB } from "../core/common.db"

// Database connection - centralized for all database operations 
// TODO: Remove this function and use the getDb function from the core/common.db.ts file
// this function is used to make a type alias for the database instance to ensure consistency
export function getDb(database?: D1Database) {
  console.warn("DEPRECATED: Use the getDb function from the core/common.db.ts file instead")
  return getCoreDb({ d1: database })
}

// Type alias for database instance to ensure consistency
export type DB = CoreDB
