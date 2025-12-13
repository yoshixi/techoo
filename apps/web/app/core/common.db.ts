import { drizzle } from "drizzle-orm/libsql"
import { v7 as uuidv7 } from "uuid"

// Database connection - centralized for all database operations
export function getDb() {
  return drizzle({
    connection: {
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!
    },
    casing: "snake_case"
  })
}

// Helper function to create consistent UUIDs across all database operations
export function createId(): string {
  return uuidv7()
}

// Type alias for database instance to ensure consistency
export type DB = ReturnType<typeof getDb>