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
      updateTimerStates: (timers: TimerState[]) => void
      onShowTaskDetail: (callback: (taskId: number) => void) => () => void
      onNotificationTimerStarted: (callback: (taskId: number) => void) => () => void
      onNotificationTimerStopped: (callback: (taskId: number) => void) => () => void
      getNotificationPermission: () => Promise<NotificationPermissionStatus>
      requestNotificationPermission: () => Promise<NotificationPermissionStatus>
      openNotificationSettings: () => Promise<void>
    }
  }
}
