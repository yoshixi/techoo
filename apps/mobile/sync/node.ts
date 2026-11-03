/**
 * Node entry for a headless harness.
 *
 * `import { SyncEngine, JournalService, createNobleCrypto, createSqliteSyncStore } from './index'`
 * is enough on its own. This module adds the built-in `node:sqlite` adapter:
 *
 * `import { openNodeSqliteDatabase } from './node'`
 */
export { openNodeSqliteDatabase } from './nodeSqlite';
export * from './index';
