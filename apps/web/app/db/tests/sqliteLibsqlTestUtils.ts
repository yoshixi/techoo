import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../index';

import { pushSQLiteSchema } from 'drizzle-kit/api';
import fs from "fs";
import os from "os";
import path from "path";

export type SqliteLibsqlTestContext = {
  db: ReturnType<typeof drizzle>;
  reset: () => Promise<void>;
};

export const getDB = (location: ":memory:" | (string & {}) = ":memory:") => {
  return drizzle(location, { schema, casing: "snake_case" });
};

export type DB = ReturnType<typeof getDB>;

export const migrateDB = async (db: DB) => {
  const { apply } = await pushSQLiteSchema(schema, db);
  await apply();
};

export const setupDB = async (prefix: string) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dbPath = path.join(tmpDir, "test.db");
  const db = getDB(`file:${dbPath}`);
  await migrateDB(db);
  return { db, tmpDir, dbPath };
};
export async function createSqliteLibsqlTestContext(): Promise<SqliteLibsqlTestContext> {
  const tmpDirPath = "./tmp/dbtests";
  const tmpDir = fs.mkdtempSync(path.join(tmpDirPath, "test_db"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = getDB(`file:${dbPath}`);
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

