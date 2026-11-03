import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type Client, type InArgs, type ResultSet } from '@libsql/client'
import type { SyncDatabase, SyncStatement } from '../../core/sync.db'

const migrationSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../../sync-migrations/0001_init.sql'),
  'utf8',
)

class LibsqlSyncStatement implements SyncStatement {
  constructor(
    private client: Client,
    private sql: string,
    private args: InArgs = [],
  ) {}

  bind(...args: Array<string | number | null>): SyncStatement {
    return new LibsqlSyncStatement(this.client, this.sql, args)
  }

  async first<T extends Record<string, unknown>>(): Promise<T | null> {
    const result = await this.client.execute({ sql: this.sql, args: this.args })
    return rowObject<T>(result, 0)
  }

  async all<T extends Record<string, unknown>>(): Promise<T[]> {
    const result = await this.client.execute({ sql: this.sql, args: this.args })
    const rows: T[] = []
    for (let index = 0; index < result.rows.length; index++) {
      const row = rowObject<T>(result, index)
      if (row) rows.push(row)
    }
    return rows
  }

  async run(): Promise<{ changes: number }> {
    const result = await this.client.execute({ sql: this.sql, args: this.args })
    return { changes: result.rowsAffected }
  }

  statement(): { sql: string; args: InArgs } {
    return { sql: this.sql, args: this.args }
  }
}

function rowObject<T extends Record<string, unknown>>(result: ResultSet, index: number): T | null {
  const row = result.rows[index]
  if (!row) return null
  const record: Record<string, unknown> = {}
  for (let column = 0; column < result.columns.length; column++) {
    const name = result.columns[column]
    if (!name) continue
    record[name] = row[column]
  }
  return record as T
}

function statementsOf(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/--[^\n]*/g, '').trim().length > 0)
}

/**
 * In-memory libSQL stand-in for the D1 binding. Applies the sync migration.
 */
export async function createMemorySyncDatabase(): Promise<{ db: SyncDatabase; close: () => void }> {
  const client = createClient({ url: ':memory:' })
  for (const statement of statementsOf(migrationSql)) {
    await client.execute(statement)
  }

  const db: SyncDatabase = {
    prepare(sql: string): SyncStatement {
      return new LibsqlSyncStatement(client, sql)
    },
    async batch(statements: SyncStatement[]): Promise<void> {
      const bound = statements.map((statement) => {
        if (!(statement instanceof LibsqlSyncStatement)) {
          throw new Error('memory batch received a statement from another driver')
        }
        return statement.statement()
      })
      await client.batch(bound, 'write')
    },
  }

  return {
    db,
    close: () => client.close(),
  }
}
