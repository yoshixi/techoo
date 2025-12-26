import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../schema/schema';
import { getDb } from '../../core/common.db';

import { pushSQLiteSchema } from 'drizzle-kit/api';
import fs from "fs";
import os from "os";
import path from "path";

export type SqliteLibsqlTestContext = {
  db: ReturnType<typeof getDb>;
  reset: () => Promise<void>;
};

export const getTestDB = (location: ":memory:" | (string & {}) = ":memory:") => {
  if (location !== ":memory:") {
    // Ensure directory exists if using file-based database
    fs.mkdirSync(path.dirname(location), { recursive: true })
  }
  
  const sqlite = new Database(location);
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema, casing: "snake_case" });
};

export type DB = ReturnType<typeof getDb>;

export const migrateDB = async (db: ReturnType<typeof getTestDB>) => {
  const { apply } = await pushSQLiteSchema(schema, db as any);
  await apply();
};

export const setupDB = async (prefix: string) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(tmpDir, "test.db");
  const db = getTestDB(`file:${dbPath}`);
  await migrateDB(db);
  return { db, tmpDir, dbPath };
};

export async function createSqliteLibsqlTestContext(): Promise<SqliteLibsqlTestContext> {
  // Use in-memory database instead of file-based for tests
  const db = getTestDB(":memory:") as any; // Type assertion for test compatibility
  await migrateDB(db);

  const reset = async () => {
    await db.delete(schema.usersTable)
    await db.delete(schema.tasksTable)
    await db.delete(schema.taskTimersTable)
  };

  return {
    db,
    reset: async () => {
      await reset();
    },
  };
}
