import { app, shell, BrowserWindow, ipcMain, screen, session } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo@2x.png?asset'
import { TrayManager } from './tray'

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
let trayManager: TrayManager | null = null

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

function createFloatingWindow(taskId: string, title?: string): void {
  // WORKAROUND Layer 0: Pre-check before creating floating window
  // Ensure main window is visible before we do anything that might hide it
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
  }

  const existing = floatingWindows.get(taskId)
  const query: Record<string, string> = { floating: '1', taskId }
  if (title) {
    query.title = title
  }

  if (existing && !existing.isDestroyed()) {
    const url = resolveRendererUrl(query)
    if (url) {
      existing.loadURL(url)
    } else {
      existing.loadFile(join(__dirname, '../renderer/index.html'), { query })
    }
    existing.showInactive()
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
    frame: false,
    transparent: true,
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false
    }
  })

  floatingWindow.setAlwaysOnTop(true, 'floating', 1)
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // WORKAROUND: Event-based protection
  // When floating window gains focus, ensure main window stays visible
  // This catches cases where user interaction with floating window hides main window
  floatingWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })

  floatingWindow.on('closed', () => {
    floatingWindows.delete(taskId)
  })

  floatingWindows.set(taskId, floatingWindow)

  // Load content and show without stealing focus
  const url = resolveRendererUrl(query)
  if (url) {
    floatingWindow.loadURL(url)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  // Show window without activating it (prevents stealing focus from main window)
  floatingWindow.showInactive()

  // ===================================================================================
  // WORKAROUND: Prevent main window from hiding when floating window opens
  // ===================================================================================
  // On macOS, showing a floating window with skipTaskbar:true and alwaysOnTop:true
  // can cause the main window to hide unexpectedly, making the app disappear from
  // Cmd+Tab. The exact cause is unclear but appears to be related to macOS window
  // management and focus handling.
  //
  // We use a multi-layer approach to ensure the main window stays visible:
  //
  // Layer 1: Synchronous - Immediately after showInactive()
  //   Catches cases where the hide happens synchronously
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
  }

  // Layer 2: Next event loop tick - Using setImmediate()
  //   Catches cases where the hide is triggered asynchronously
  setImmediate(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  })
  // ===================================================================================
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
    width: 1400,
    height: 900,
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

  // WORKAROUND: Main window hide event protection
  // If main window receives a hide event while floating windows exist,
  // immediately restore it. This is the last line of defense against
  // unexpected hiding caused by macOS window management.
  mainWindow.on('hide', () => {
    if (floatingWindows.size > 0 && mainWindow && !mainWindow.isDestroyed()) {
      setImmediate(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          mainWindow.show()
        }
      })
    }
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
  ipcMain.handle('floating-task:open', (_event, payload: { taskId: string; title?: string }) => {
    if (!payload?.taskId) return
    createFloatingWindow(payload.taskId, payload.title)
  })
  ipcMain.handle('floating-task:close', (_event, taskId?: string) => {
    closeFloatingWindow(taskId)
  })

  // Timer state updates from renderer for tray display
  ipcMain.on(
    'timer:state-change',
    (_event, state: { taskId: string; taskTitle: string; startTime: string } | null) => {
      trayManager?.updateTimerState(state)
    }
  )

  createWindow()

  // Initialize tray after window is created
  trayManager = new TrayManager(() => mainWindow)
  trayManager.init()

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

// Cleanup tray before quitting
app.on('before-quit', () => {
  trayManager?.destroy()
  trayManager = null
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
