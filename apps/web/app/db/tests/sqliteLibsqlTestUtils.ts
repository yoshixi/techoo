import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../schema/schema';
import { pushSQLiteSchema } from 'drizzle-kit/api';
import fs from "fs";
import os from "os";
import path from "path";
import { type DB } from '../../core/common.db';

export type SqliteLibsqlTestContext = {
  db: DB;
  reset: () => Promise<void>;
};

const IN_MEMORY_URL = 'file::memory:?cache=shared';

const ensureDirectoryForUrl = (url: string) => {
  if (!url.startsWith('file:')) return;
  if (url.startsWith('file::memory')) return;

  const filePath = url.replace(/^file:/, '');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

export const getTestDB = (
  location: ":memory:" | `file:${string}` = ":memory:"
): DB => {
  const url = location === ":memory:" ? IN_MEMORY_URL : location;
  ensureDirectoryForUrl(url);

  const client = createClient({ url });
  return drizzle({
    client,
    schema,
    casing: "snake_case",
  });
};

export const migrateDB = async (db: ReturnType<typeof getTestDB>) => {
  const { apply } = await pushSQLiteSchema(schema, db);
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
  const db = getTestDB(":memory:");
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
