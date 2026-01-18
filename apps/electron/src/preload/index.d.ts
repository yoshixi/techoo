import { ElectronAPI } from '@electron-toolkit/preload'

interface TimerState {
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
      updateTimerState: (state: TimerState | null) => void
    }
  }
}
