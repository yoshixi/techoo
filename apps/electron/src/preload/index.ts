import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openFloatingTaskWindow: (payload: { taskId: string }) =>
    ipcRenderer.invoke('floating-task:open', payload),
  closeFloatingTaskWindow: (taskId: string) => ipcRenderer.invoke('floating-task:close', taskId)
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
