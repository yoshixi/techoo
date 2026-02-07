import { ElectronAPI } from '@electron-toolkit/preload'

interface TimerState {
  timerId: string
  taskId: string
  taskTitle: string
  startTime: string
}

type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

interface AuthAPI {
  openAuthUrl: (url: string) => Promise<void>
  getRedirectUri: () => Promise<string>
  onCallbackUrl: (callback: (url: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      auth: AuthAPI
      updateTimerStates: (timers: TimerState[]) => void
      onShowTaskDetail: (callback: (taskId: string) => void) => () => void
      onNotificationTimerStarted: (callback: (taskId: string) => void) => () => void
      onNotificationTimerStopped: (callback: (taskId: string) => void) => () => void
      getNotificationPermission: () => Promise<NotificationPermissionStatus>
      requestNotificationPermission: () => Promise<NotificationPermissionStatus>
      openNotificationSettings: () => Promise<void>
    }
  }
}
