import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      openFloatingTaskWindow: (payload: { taskId: string }) => Promise<void>
      closeFloatingTaskWindow: (taskId: string) => Promise<void>
    }
  }
}
