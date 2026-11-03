import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Timer state type (supports multiple timers)
interface TimerState {
  timerId: number
  taskId: number
  taskTitle: string
  startTime: string
}

// Notification permission status type
type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

// Custom APIs for renderer
const api = {
  // Auth token management
  updateAuthToken: (token: string | null): void => {
    ipcRenderer.send('auth:token-update', token)
  },
  getSessionToken: (): Promise<string | null> => ipcRenderer.invoke('auth:get-session-token'),
  setSessionToken: (token: string): Promise<void> =>
    ipcRenderer.invoke('auth:set-session-token', token),
  clearSessionToken: (): Promise<void> => ipcRenderer.invoke('auth:clear-session-token'),
  // Update all active timer states for tray display
  updateTimerStates: (timers: TimerState[]): void => {
    ipcRenderer.send('timer:states-change', timers)
  },
  // Listen for show task detail request from tray menu (receives taskId)
  onShowTaskDetail: (callback: (taskId: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: number): void => {
      callback(taskId)
    }
    ipcRenderer.on('tray:show-task-detail', handler)
    return () => {
      ipcRenderer.removeListener('tray:show-task-detail', handler)
    }
  },
  // Notification permission APIs
  getNotificationPermission: (): Promise<NotificationPermissionStatus> =>
    ipcRenderer.invoke('notification:get-permission'),
  requestNotificationPermission: (): Promise<NotificationPermissionStatus> =>
    ipcRenderer.invoke('notification:request-permission'),
  openNotificationSettings: (): Promise<void> => ipcRenderer.invoke('notification:open-settings'),
  // OAuth social sign-in via popup BrowserWindow
  signInWithOAuth: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('auth:social-sign-in', provider),
  // Link additional social account for the current user
  linkSocialAccount: (provider: string, sessionToken: string): Promise<boolean> =>
    ipcRenderer.invoke('auth:social-link', provider, sessionToken),
  syncPrepare: (): Promise<SyncCallResult> => ipcRenderer.invoke('sync:prepare'),
  syncGetStatus: (): Promise<SyncCallResult> => ipcRenderer.invoke('sync:get-status'),
  syncSetup: (passphrase: string): Promise<SyncCallResult> =>
    ipcRenderer.invoke('sync:setup', passphrase),
  syncUnlock: (passphrase: string): Promise<SyncCallResult> =>
    ipcRenderer.invoke('sync:unlock', passphrase),
  syncLock: (): Promise<SyncCallResult> => ipcRenderer.invoke('sync:lock'),
  syncReset: (passphrase: string): Promise<SyncCallResult> =>
    ipcRenderer.invoke('sync:reset', passphrase),
  syncReplaceServer: (): Promise<SyncCallResult> => ipcRenderer.invoke('sync:replace-server'),
  syncDiscardAndJoin: (passphrase: string): Promise<SyncCallResult> =>
    ipcRenderer.invoke('sync:discard-and-join', passphrase),
  syncNow: (): Promise<SyncCallResult> => ipcRenderer.invoke('sync:now'),
  onSyncStatus: (callback: (status: SyncStatusPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: SyncStatusPayload): void => {
      callback(status)
    }
    ipcRenderer.on('sync:status', handler)
    return () => {
      ipcRenderer.removeListener('sync:status', handler)
    }
  },
  journalList: (
    kind: JournalKind
  ): Promise<SyncCallResult & { records?: JournalRecordPayload[] }> =>
    ipcRenderer.invoke('journal:list', kind),
  journalSave: (draft: {
    recordId?: string
    kind: JournalKind
    fields: Record<string, string | number | boolean>
  }): Promise<SyncCallResult & { record?: JournalRecordPayload }> =>
    ipcRenderer.invoke('journal:save', draft),
  journalDelete: (recordId: string): Promise<SyncCallResult> =>
    ipcRenderer.invoke('journal:delete', recordId)
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

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
// docs:https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
