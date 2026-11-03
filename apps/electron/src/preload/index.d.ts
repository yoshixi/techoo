import { ElectronAPI } from '@electron-toolkit/preload'

interface TimerState {
  timerId: number
  taskId: number
  taskTitle: string
  startTime: string
}

type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      updateAuthToken: (token: string | null) => void
      getSessionToken: () => Promise<string | null>
      setSessionToken: (token: string) => Promise<void>
      clearSessionToken: () => Promise<void>
      updateTimerStates: (timers: TimerState[]) => void
      onShowTaskDetail: (callback: (taskId: number) => void) => () => void
      getNotificationPermission: () => Promise<NotificationPermissionStatus>
      requestNotificationPermission: () => Promise<NotificationPermissionStatus>
      openNotificationSettings: () => Promise<void>
      signInWithOAuth: (provider: string) => Promise<string | null>
      linkSocialAccount: (provider: string, sessionToken: string) => Promise<boolean>
      syncPrepare: () => Promise<SyncCallResult>
      syncGetStatus: () => Promise<SyncCallResult>
      syncSetup: (passphrase: string) => Promise<SyncCallResult>
      syncUnlock: (passphrase: string) => Promise<SyncCallResult>
      syncLock: () => Promise<SyncCallResult>
      syncReset: (passphrase: string) => Promise<SyncCallResult>
      syncReplaceServer: () => Promise<SyncCallResult>
      syncDiscardAndJoin: (passphrase: string) => Promise<SyncCallResult>
      syncNow: () => Promise<SyncCallResult>
      onSyncStatus: (callback: (status: SyncStatusPayload) => void) => () => void
      journalList: (
        kind: JournalKind
      ) => Promise<SyncCallResult & { records?: JournalRecordPayload[] }>
      journalSave: (draft: {
        recordId?: string
        kind: JournalKind
        fields: Record<string, string | number | boolean>
      }) => Promise<SyncCallResult & { record?: JournalRecordPayload }>
      journalDelete: (recordId: string) => Promise<SyncCallResult>
    }
  }
}

type JournalKind = 'todo' | 'post' | 'note'

interface SyncStatusPayload {
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

interface JournalRecordPayload {
  recordId: string
  kind: JournalKind
  deleted: boolean
  updatedAt: string
  fields: Record<string, string | number | boolean>
  dirty: boolean
}

interface SyncCallResult {
  ok: boolean
  code: string
  reason: string | null
  status: SyncStatusPayload
}
