import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'

import {
  CryptoAuthError,
  SqliteJournalStore,
  SyncChainError,
  SyncDecryptError,
  SyncEngine,
  SyncOfflineError,
  SyncVaultExistsError,
  SyncVaultResetError,
  createFetchTransport,
  type RecordKind,
  type SyncReport
} from './index'
import type { JsonValue } from './payload'

export interface SyncStatusPayload {
  phase: 'setup' | 'locked' | 'ready' | 'offline' | 'conflict' | 'error'
  unlocked: boolean
  hasLocalVault: boolean
  vaultId: string | null
  deviceId: string
  cursor: number
  pendingCount: number
  dirtyCount: number
  lastSyncedAt: string | null
  lastError: string | null
}

export interface JournalRecordPayload {
  recordId: string
  kind: RecordKind
  deleted: boolean
  updatedAt: string
  fields: { [key: string]: JsonValue }
  dirty: boolean
}

interface SyncCallResult {
  ok: boolean
  code: string
  reason: string | null
  status: SyncStatusPayload
  report?: SyncReport
}

export interface SyncController {
  lock: () => void
  nudge: () => void
  dispose: () => void
}

function failureCode(error: unknown): { code: string; reason: string } {
  if (error instanceof CryptoAuthError) return { code: 'auth', reason: 'Wrong passphrase' }
  if (error instanceof SyncVaultExistsError) {
    return { code: 'vault_exists', reason: 'A vault already exists on the server' }
  }
  if (error instanceof SyncVaultResetError) {
    return { code: 'vault_reset', reason: 'The server vault was replaced' }
  }
  if (error instanceof SyncOfflineError) {
    return {
      code: 'offline',
      reason: 'Saved on this device. Sync will retry when the network is back.'
    }
  }
  if (error instanceof SyncChainError) {
    return { code: 'chain_break', reason: 'The sync log failed verification and was not applied' }
  }
  if (error instanceof SyncDecryptError) {
    return {
      code: 'decrypt_failed',
      reason: 'A sync op could not be decrypted and was not applied'
    }
  }
  if (error instanceof Error && error.message === 'vault is locked') {
    return { code: 'locked', reason: 'Unlock the journal first' }
  }
  return { code: 'error', reason: error instanceof Error ? error.message : 'Sync failed' }
}

export function registerSyncIpc(options: {
  userDataPath: string
  apiBaseUrl: string
  getToken: () => string | null
  getWindow: () => BrowserWindow | null
}): SyncController {
  const store = SqliteJournalStore.open(join(options.userDataPath, 'e2ee-journal.sqlite'))
  const engine = new SyncEngine(
    store,
    createFetchTransport({
      apiBaseUrl: options.apiBaseUrl,
      getToken: options.getToken
    })
  )
  let lastCode: string | null = null
  let lastError: string | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  const status = (): SyncStatusPayload => {
    const current = engine.status()
    let phase: SyncStatusPayload['phase']
    if (lastCode === 'vault_reset' || lastCode === 'vault_exists') phase = 'conflict'
    else if (!current.unlocked) phase = current.hasLocalVault ? 'locked' : 'setup'
    else if (lastCode === 'offline') phase = 'offline'
    else if (lastCode && lastCode !== 'ok') phase = 'error'
    else phase = 'ready'
    return {
      phase,
      unlocked: current.unlocked,
      hasLocalVault: current.hasLocalVault,
      vaultId: current.vaultId,
      deviceId: current.deviceId,
      cursor: current.cursor,
      pendingCount: current.pendingCount,
      dirtyCount: current.dirtyCount,
      lastSyncedAt: current.lastSyncedAt,
      lastError
    }
  }

  const publish = (): void => {
    options.getWindow()?.webContents.send('sync:status', status())
  }

  const succeed = (report?: SyncReport): SyncCallResult => {
    if (report?.offline) {
      lastCode = 'offline'
      lastError = 'Saved on this device. Sync will retry when the network is back.'
    } else {
      lastCode = null
      lastError = null
    }
    publish()
    return { ok: true, code: 'ok', reason: null, status: status(), ...(report ? { report } : {}) }
  }

  const fail = (error: unknown): SyncCallResult => {
    const mapped = failureCode(error)
    lastCode = mapped.code
    lastError = mapped.reason
    publish()
    return { ok: false, code: mapped.code, reason: mapped.reason, status: status() }
  }

  const run = async (fn: () => Promise<SyncReport | void>): Promise<SyncCallResult> => {
    try {
      const report = await fn()
      return succeed(report ?? undefined)
    } catch (error) {
      return fail(error)
    }
  }

  const nudge = (): void => {
    if (!engine.isUnlocked()) return
    void run(() => engine.sync())
  }

  const armTimer = (): void => {
    if (timer) return
    timer = setInterval(nudge, 30_000)
  }

  const lock = (): void => {
    engine.lock()
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    lastCode = null
    lastError = null
    publish()
  }

  ipcMain.handle('sync:prepare', async () => {
    try {
      const found = await engine.discover()
      if (found === 'offline' && !engine.hasLocalVault()) {
        lastCode = null
        lastError =
          'The server could not be reached. You can create a vault on this device and register it later.'
      }
      publish()
      return { ok: true, code: 'ok', reason: null, status: status() }
    } catch (error) {
      return fail(error)
    }
  })

  ipcMain.handle('sync:get-status', () => ({
    ok: true,
    code: 'ok',
    reason: null,
    status: status()
  }))

  ipcMain.handle('sync:setup', async (_event, passphrase: string) => {
    const result = await run(() => engine.setup(passphrase))
    if (engine.isUnlocked()) armTimer()
    return result
  })

  ipcMain.handle('sync:unlock', async (_event, passphrase: string) => {
    const result = await run(async () => {
      await engine.unlock(passphrase)
      return engine.sync()
    })
    if (engine.isUnlocked()) armTimer()
    return result
  })

  ipcMain.handle('sync:lock', () => {
    lock()
    return succeed()
  })

  ipcMain.handle('sync:reset', async (_event, passphrase: string) => {
    const result = await run(() => engine.reset(passphrase))
    if (engine.isUnlocked()) armTimer()
    return result
  })

  ipcMain.handle('sync:replace-server', () => run(() => engine.replaceServerWithLocal()))

  ipcMain.handle('sync:discard-and-join', async (_event, passphrase: string) => {
    const result = await run(() => engine.discardAndJoin(passphrase))
    if (engine.isUnlocked()) armTimer()
    return result
  })

  ipcMain.handle('sync:now', () => run(() => engine.sync()))

  ipcMain.handle('journal:list', (_event, kind: RecordKind) => {
    if (!engine.isUnlocked()) return fail(new Error('vault is locked'))
    const records: JournalRecordPayload[] = engine.listRecords(kind).map((record) => ({
      recordId: record.recordId,
      kind: record.kind,
      deleted: record.deleted,
      updatedAt: record.updatedAt,
      fields: record.fields,
      dirty: record.dirty
    }))
    publish()
    return { ok: true, code: 'ok', reason: null, status: status(), records }
  })

  ipcMain.handle(
    'journal:save',
    (
      _event,
      draft: { recordId?: string; kind: RecordKind; fields: { [key: string]: JsonValue } }
    ) => {
      try {
        const record = engine.upsertRecord(draft)
        nudge()
        publish()
        return {
          ok: true,
          code: 'ok',
          reason: null,
          status: status(),
          record: {
            recordId: record.recordId,
            kind: record.kind,
            deleted: record.deleted,
            updatedAt: record.updatedAt,
            fields: record.fields,
            dirty: record.dirty
          }
        }
      } catch (error) {
        return fail(error)
      }
    }
  )

  ipcMain.handle('journal:delete', (_event, recordId: string) => {
    try {
      engine.deleteRecord(recordId)
      nudge()
      publish()
      return { ok: true, code: 'ok', reason: null, status: status() }
    } catch (error) {
      return fail(error)
    }
  })

  return {
    lock,
    nudge,
    dispose: () => {
      if (timer) clearInterval(timer)
      timer = null
      engine.lock()
      store.close()
    }
  }
}
