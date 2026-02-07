import { app, shell, BrowserWindow, ipcMain, session, Menu, globalShortcut } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo@2x.png?asset'
import { TrayManager } from './tray'
import { NotificationScheduler, type NotificationPermissionStatus } from './notificationScheduler'
import {
  registerProtocolHandler,
  handleOAuthCallback,
  setMainWindow,
  openAuthUrl,
  REDIRECT_URI
} from './auth/authFlow'

// Register protocol handler before app is ready
registerProtocolHandler()

function setupContentSecurityPolicy(): void {
  const apiUrl = import.meta.env.MAIN_VITE_API_URL || 'http://localhost:3000'

  // Clerk SDK domains for authentication
  const clerkDomains = 'https://*.clerk.accounts.dev https://clerk.accounts.dev'

  // Build connect-src directive with configured API URL and Clerk domains
  const connectSrc = `'self' ${apiUrl} ${clerkDomains}`

  // In development, Vite's HMR requires unsafe-inline and unsafe-eval for scripts
  // In production, we use strict CSP
  const scriptSrc = is.dev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"

  // Worker source for Clerk SDK (uses blob: for web workers)
  const workerSrc = "'self' blob:"

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.clerk.com",
    `connect-src ${connectSrc}`,
    `worker-src ${workerSrc}`
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
let trayManager: TrayManager | null = null
let notificationScheduler: NotificationScheduler | null = null

function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const }
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }])
      ]
    },
    // View menu with zoom controls
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: (): void => {
            const focusedWindow = BrowserWindow.getFocusedWindow()
            if (focusedWindow) {
              focusedWindow.webContents.setZoomLevel(0)
            }
          }
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: (): void => {
            const focusedWindow = BrowserWindow.getFocusedWindow()
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomLevel()
              focusedWindow.webContents.setZoomLevel(currentZoom + 0.5)
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: (): void => {
            const focusedWindow = BrowserWindow.getFocusedWindow()
            if (focusedWindow) {
              const currentZoom = focusedWindow.webContents.getZoomLevel()
              focusedWindow.webContents.setZoomLevel(currentZoom - 0.5)
            }
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
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

  mainWindow.on('closed', () => {
    mainWindow = null
    setMainWindow(null)
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

  // Setup application menu with standard shortcuts (zoom, edit, etc.)
  createApplicationMenu()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Auth IPC handlers
  ipcMain.handle('auth:open-url', async (_event, url: string) => {
    await openAuthUrl(url)
  })

  ipcMain.handle('auth:get-redirect-uri', () => {
    return REDIRECT_URI
  })

  // Notification permission handlers
  ipcMain.handle('notification:get-permission', (): NotificationPermissionStatus => {
    return NotificationScheduler.getPermissionStatus()
  })
  ipcMain.handle('notification:request-permission', async (): Promise<NotificationPermissionStatus> => {
    return NotificationScheduler.requestPermission()
  })
  ipcMain.handle('notification:open-settings', () => {
    NotificationScheduler.openNotificationSettings()
  })

  // Timer states updates from renderer for tray display (supports multiple timers)
  ipcMain.on(
    'timer:states-change',
    (
      _event,
      timers: { timerId: string; taskId: string; taskTitle: string; startTime: string }[]
    ) => {
      trayManager?.updateTimerStates(timers)
    }
  )

  createWindow()

  // Set main window reference for auth flow IPC
  setMainWindow(mainWindow)

  // Register global shortcuts for zoom (fallback for keyboard layouts where menu accelerators don't work)
  globalShortcut.register('CommandOrControl+-', () => {
    const focusedWindow = BrowserWindow.getFocusedWindow()
    if (focusedWindow) {
      const currentZoom = focusedWindow.webContents.getZoomLevel()
      focusedWindow.webContents.setZoomLevel(currentZoom - 0.5)
    }
  })

  // Initialize tray after window is created
  trayManager = new TrayManager(() => mainWindow)
  trayManager.init()

  // Wire up show task detail callback - opens task modal in renderer
  trayManager.setOnShowTaskDetail((taskId: string) => {
    mainWindow?.webContents.send('tray:show-task-detail', taskId)
  })

  // Initialize notification scheduler for task reminders
  notificationScheduler = new NotificationScheduler()
  notificationScheduler.setHandlers({
    onStartTimer: (taskId: string) => {
      // Notify renderer to refresh timers
      mainWindow?.webContents.send('notification:timer-started', taskId)
    },
    onStopTimer: (taskId: string) => {
      // Notify renderer to refresh timers
      mainWindow?.webContents.send('notification:timer-stopped', taskId)
    },
    onShowTask: (taskId: string) => {
      // Show the main window and open task detail
      mainWindow?.show()
      mainWindow?.webContents.send('tray:show-task-detail', taskId)
    }
  })
  notificationScheduler.start()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      setMainWindow(mainWindow)
    }
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

// Handle OAuth callback via deep link (macOS)
app.on('open-url', async (event, url) => {
  event.preventDefault()
  const handled = await handleOAuthCallback(url)
  if (handled) {
    // Focus the main window after successful OAuth
    mainWindow?.show()
    mainWindow?.focus()
  }
})

// Handle OAuth callback via deep link (Windows/Linux - second instance)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (_event, argv) => {
    // Find the URL in argv (Windows passes it as last argument)
    const url = argv.find(arg => arg.startsWith('shuchu://'))
    if (url) {
      const handled = await handleOAuthCallback(url)
      if (handled) {
        mainWindow?.show()
        mainWindow?.focus()
      }
    } else {
      // No URL, just focus the window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    }
  })
}

// Cleanup tray, shortcuts, and notification scheduler before quitting
app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  notificationScheduler?.stop()
  notificationScheduler = null
  trayManager?.destroy()
  trayManager = null
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
