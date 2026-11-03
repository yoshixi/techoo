import type { SqlDatabase, SqlValue } from './store';

type Statement = {
  run(...params: SqlValue[]): { changes: number; lastInsertRowid: number | bigint };
  get(...params: SqlValue[]): Record<string, unknown> | undefined;
  all(...params: SqlValue[]): Record<string, unknown>[];
};

type NodeDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
};

declare function require(specifier: string): { DatabaseSync: new (path: string) => NodeDatabase };

/**
 * Node's built-in `node:sqlite`. The React Native app does not import this module.
 * A headless harness should import `openNodeSqliteDatabase` from `./node`.
 */
export async function openNodeSqliteDatabase(filename = ':memory:'): Promise<SqlDatabase> {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(filename);
  return {
    async exec(sql: string) {
      db.exec(sql);
    },
    async run(sql: string, params: SqlValue[] = []) {
      db.prepare(sql).run(...params);
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
}
