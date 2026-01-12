import { app, shell, BrowserWindow, ipcMain, screen, session } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo@2x.png?asset'

function setupContentSecurityPolicy(): void {
  const apiUrl = import.meta.env.MAIN_VITE_API_URL || 'http://localhost:3000'

  // Build connect-src directive with configured API URL
  const connectSrc = `'self' ${apiUrl}`

  // In development, Vite's HMR requires unsafe-inline and unsafe-eval for scripts
  // In production, we use strict CSP
  const scriptSrc = is.dev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src ${connectSrc}`
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}

// Modified default preload logic
//
//   7     +function resolvePreloadPath(): string {
//   8     +  const candidates = ['index.js', 'index.cjs', 'index.mjs']
//   9     +  for (const file of candidates) {
//   10    +    const fullPath = join(__dirname, '../preload', file)
//   11    +    if (existsSync(fullPath)) {
//   12    +      return fullPath
//   16    +  return join(__dirname, '../preload/index.js')
//   17    +}
//   18    +
//   19     function createWindow(): void {
//   ⋮
//   27         webPreferences: {
//   15    -      preload: join(__dirname, '../preload/index.js'),
//   28    +      preload: resolvePreloadPath(),
//   29           sandbox: false
function resolvePreloadPath(): string {
  const candidates = ['index.js', 'index.cjs', 'index.mjs']
  for (const file of candidates) {
    const fullPath = join(__dirname, '../preload', file)
    if (existsSync(fullPath)) {
      return fullPath
    }
  }

  return join(__dirname, '../preload/index.js')
}

let mainWindow: BrowserWindow | null = null
const floatingWindows = new Map<string, BrowserWindow>()

function resolveRendererUrl(query?: Record<string, string>): string | null {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (query) {
      Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    }
    return url.toString()
  }
  return null
}

function createFloatingWindow(taskId: string): void {
  const existing = floatingWindows.get(taskId)

  if (existing && !existing.isDestroyed()) {
    const url = resolveRendererUrl({ floating: '1', taskId })
    if (url) {
      existing.loadURL(url)
    } else {
      existing.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { floating: '1', taskId }
      })
    }
    existing.show()
    existing.focus()
    return
  }

  const windowWidth = 360
  const windowHeight = 120
  const margin = 20
  const verticalSpacing = 10

  // Get the primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  // Calculate top-right position
  let x = screenWidth - windowWidth - margin
  let y = margin

  // Stack windows vertically if others exist
  const existingWindows = Array.from(floatingWindows.values()).filter((w) => !w.isDestroyed())
  if (existingWindows.length > 0) {
    // Position below the last window
    const lastWindow = existingWindows[existingWindows.length - 1]
    const [, lastY] = lastWindow.getPosition()
    const [, lastHeight] = lastWindow.getSize()
    y = lastY + lastHeight + verticalSpacing
  }

  const floatingWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: mainWindow ?? undefined,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false
    }
  })

  floatingWindow.setAlwaysOnTop(true, 'screen-saver') // configuration for floating window to always stay on top
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  floatingWindow.on('closed', () => {
    floatingWindows.delete(taskId)
  })

  const url = resolveRendererUrl({ floating: '1', taskId })
  if (url) {
    floatingWindow.loadURL(url)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { floating: '1', taskId }
    })
  }

  floatingWindows.set(taskId, floatingWindow)
}

function closeFloatingWindow(taskId?: string): void {
  if (!taskId) {
    floatingWindows.forEach((window) => {
      if (!window.isDestroyed()) window.close()
    })
    floatingWindows.clear()
    return
  }
  const window = floatingWindows.get(taskId)
  if (window && !window.isDestroyed()) {
    window.close()
  }
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    closeFloatingWindow()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.shuchu.app')

  // Setup CSP based on environment configuration
  setupContentSecurityPolicy()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('floating-task:open', (_event, payload: { taskId: string; title: string }) => {
    if (!payload?.taskId) return
    createFloatingWindow(payload.taskId)
  })
  ipcMain.handle('floating-task:close', (_event, taskId?: string) => {
    closeFloatingWindow(taskId)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
