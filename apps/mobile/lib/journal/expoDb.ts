import * as SQLite from 'expo-sqlite';
import type { SqlDatabase, SqlValue } from '@/sync/store';

export async function openExpoJournalDatabase(): Promise<SqlDatabase> {
  const db = await SQLite.openDatabaseAsync('techoo-journal.db');
  return {
    async exec(sql) {
      await db.execAsync(sql);
    },
    async run(sql, params: SqlValue[] = []) {
      await db.runAsync(sql, params);
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const row = await db.getFirstAsync<T>(sql, params);
      return row ?? null;
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.getAllAsync<T>(sql, params);
    },
  };
}
