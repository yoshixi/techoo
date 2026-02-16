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
  // Listen for timer started from notification action
  onNotificationTimerStarted: (callback: (taskId: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: number): void => {
      callback(taskId)
    }
    ipcRenderer.on('notification:timer-started', handler)
    return () => {
      ipcRenderer.removeListener('notification:timer-started', handler)
    }
  },
  // Listen for timer stopped from notification action
  onNotificationTimerStopped: (callback: (taskId: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: number): void => {
      callback(taskId)
    }
    ipcRenderer.on('notification:timer-stopped', handler)
    return () => {
      ipcRenderer.removeListener('notification:timer-stopped', handler)
    }
  },
  // Notification permission APIs
  getNotificationPermission: (): Promise<NotificationPermissionStatus> =>
    ipcRenderer.invoke('notification:get-permission'),
  requestNotificationPermission: (): Promise<NotificationPermissionStatus> =>
    ipcRenderer.invoke('notification:request-permission'),
  openNotificationSettings: (): Promise<void> =>
    ipcRenderer.invoke('notification:open-settings'),
  // OAuth social sign-in via popup BrowserWindow
  signInWithOAuth: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('auth:social-sign-in', provider),
  // Link additional social account for the current user
  linkSocialAccount: (provider: string, sessionToken: string): Promise<boolean> =>
    ipcRenderer.invoke('auth:social-link', provider, sessionToken)
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
