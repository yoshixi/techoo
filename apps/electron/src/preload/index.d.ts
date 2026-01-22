import { ElectronAPI } from '@electron-toolkit/preload'

interface TimerState {
  timerId: string
  taskId: string
  taskTitle: string
  startTime: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openFloatingTaskWindow: (payload: { taskId: string; title?: string }) => Promise<void>
      closeFloatingTaskWindow: (taskId: string) => Promise<void>
      updateTimerStates: (timers: TimerState[]) => void
      onShowTaskDetail: (callback: (taskId: string) => void) => () => void
    }
  }
}
