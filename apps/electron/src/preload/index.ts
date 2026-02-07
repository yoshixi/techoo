import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Timer state type (supports multiple timers)
interface TimerState {
  timerId: string
  taskId: string
  taskTitle: string
  startTime: string
}

// Notification permission status type
type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

// Custom APIs for renderer
const api = {
  // Auth APIs
  auth: {
    // Open OAuth URL in system browser
    openAuthUrl: (url: string): Promise<void> => ipcRenderer.invoke('auth:open-url', url),
    // Get the OAuth redirect URI (different in dev vs prod to avoid conflicts)
    getRedirectUri: (): Promise<string> => ipcRenderer.invoke('auth:get-redirect-uri'),
    // Listen for OAuth callback URL from main process
    onCallbackUrl: (callback: (url: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, url: string): void => {
        callback(url)
      }
      ipcRenderer.on('auth:callback-url', handler)
      return () => {
        ipcRenderer.removeListener('auth:callback-url', handler)
      }
    }
  },
  // Update all active timer states for tray display
  updateTimerStates: (timers: TimerState[]): void => {
    ipcRenderer.send('timer:states-change', timers)
  },
  // Listen for show task detail request from tray menu (receives taskId)
  onShowTaskDetail: (callback: (taskId: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: string): void => {
      callback(taskId)
    }
    ipcRenderer.on('tray:show-task-detail', handler)
    return () => {
      ipcRenderer.removeListener('tray:show-task-detail', handler)
    }
  },
  // Listen for timer started from notification action
  onNotificationTimerStarted: (callback: (taskId: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: string): void => {
      callback(taskId)
    }
    ipcRenderer.on('notification:timer-started', handler)
    return () => {
      ipcRenderer.removeListener('notification:timer-started', handler)
    }
  },
  // Listen for timer stopped from notification action
  onNotificationTimerStopped: (callback: (taskId: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, taskId: string): void => {
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
    ipcRenderer.invoke('notification:open-settings')
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
