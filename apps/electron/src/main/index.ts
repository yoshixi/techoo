import { app, shell, BrowserWindow, ipcMain, session, Menu, globalShortcut } from 'electron'
import { createServer, type Server } from 'node:http'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo@2x.png?asset'
import oauthCallbackHtml from './oauth-callback.html?raw'
import { TrayManager } from './tray'
import { NotificationScheduler, type NotificationPermissionStatus } from './notificationScheduler'
import { readSessionToken, writeSessionToken, clearSessionToken } from './sessionTokenStore'

function setupContentSecurityPolicy(): void {
  const apiUrl = import.meta.env.MAIN_VITE_API_BASE_URL || 'http://localhost:8787'

  // Build connect-src directive with configured API URL and OAuth providers
  const connectSrc = `'self' ${apiUrl} https://accounts.google.com https://github.com https://appleid.apple.com`

  // In development, Vite's HMR requires unsafe-inline and unsafe-eval for scripts
  // In production, we use strict CSP
  const scriptSrc = is.dev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'"

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.googleusercontent.com https://avatars.githubusercontent.com",
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

interface OAuthCallbackServer {
  port: number
  waitForCode: () => Promise<string | null>
  close: () => void
}

interface OAuthLinkCallbackServer {
  port: number
  waitForResult: () => Promise<boolean>
  close: () => void
}

function startOAuthCallbackServer(): Promise<OAuthCallbackServer> {
  return new Promise((resolveSetup) => {
    let resolveCode: ((code: string | null) => void) | null = null
    const codePromise = new Promise<string | null>((resolve) => {
      resolveCode = resolve
    })

    // Timeout: resolve with null after 5 minutes
    const timeout = setTimeout(() => {
      if (resolveCode) {
        resolveCode(null)
        resolveCode = null
      }
    }, 5 * 60 * 1000)

    const server: Server = createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404)
        res.end()
        return
      }

      // Extract short-lived code from query parameter (set by desktop OAuth callback endpoint)
      const url = new URL(req.url, `http://localhost`)
      const code = url.searchParams.get('code')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        oauthCallbackHtml.replace(
          'window.location.search',
          JSON.stringify(`?ok=${code ? '1' : '0'}&action=signin`)
        )
      )

      clearTimeout(timeout)
      if (resolveCode) {
        resolveCode(code)
        resolveCode = null
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolveSetup({
        port,
        waitForCode: () => codePromise,
        close: () => {
          clearTimeout(timeout)
          server.close()
        },
      })
    })
  })
}

async function exchangeSessionCode(apiUrl: string, code: string): Promise<string | null> {
  const res = await fetch(`${apiUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  if (!res.ok) return null
  const data = (await res.json()) as { session_token?: string }
  return data.session_token ?? null
}

async function requestSessionCode(
  apiUrl: string,
  sessionToken: string
): Promise<string | null> {
  const res = await fetch(`${apiUrl}/session-code`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` }
  })
  if (!res.ok) return null
  const data = (await res.json()) as { code?: string }
  return data.code ?? null
}

function startOAuthLinkCallbackServer(): Promise<OAuthLinkCallbackServer> {
  return new Promise((resolveSetup) => {
    let resolveResult: ((linked: boolean) => void) | null = null
    const resultPromise = new Promise<boolean>((resolve) => {
      resolveResult = resolve
    })

    const timeout = setTimeout(() => {
      if (resolveResult) {
        resolveResult(false)
        resolveResult = null
      }
    }, 5 * 60 * 1000)

    const server: Server = createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404)
        res.end()
        return
      }

      const url = new URL(req.url, 'http://localhost')
      const linked = url.searchParams.get('linked') === '1'

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        oauthCallbackHtml.replace(
          'window.location.search',
          JSON.stringify(`?ok=${linked ? '1' : '0'}&action=link`)
        )
      )

      clearTimeout(timeout)
      if (resolveResult) {
        resolveResult(linked)
        resolveResult = null
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolveSetup({
        port,
        waitForResult: () => resultPromise,
        close: () => {
          clearTimeout(timeout)
          server.close()
        },
      })
    })
  })
}

let mainWindow: BrowserWindow | null = null
let trayManager: TrayManager | null = null
let notificationScheduler: NotificationScheduler | null = null
let authToken: string | null = null
let sessionTokenCache: string | null = null

export function getAuthToken(): string | null {
  return authToken
}

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
  electronApp.setAppUserModelId('com.techoo.app')

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

  // Auth token IPC — renderer sends JWT for main process use (tray, notifications)
  ipcMain.on('auth:token-update', (_event, token: string | null) => {
    authToken = token
    trayManager?.setAuthToken(token)
    notificationScheduler?.setAuthToken(token)
  })

  ipcMain.handle('auth:get-session-token', () => {
    if (sessionTokenCache === null) {
      sessionTokenCache = readSessionToken()
    }
    return sessionTokenCache
  })

  ipcMain.handle('auth:set-session-token', (_event, token: string) => {
    sessionTokenCache = token
    writeSessionToken(token)
  })

  ipcMain.handle('auth:clear-session-token', () => {
    sessionTokenCache = null
    clearSessionToken()
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

  // OAuth social sign-in via system browser
  // Opens the default browser for OAuth (supports passkeys, biometrics, etc.)
  // and uses a temporary loopback HTTP server to receive the callback.
  // The entire OAuth flow happens in the browser so state cookies are consistent.
  ipcMain.handle('auth:social-sign-in', async (_event, provider: string) => {
    const apiUrl = `${import.meta.env.MAIN_VITE_API_BASE_URL || 'http://localhost:8787'}/api`

    // Start a temporary local server to receive the OAuth callback
    const callbackServer = await startOAuthCallbackServer()
    console.log(`opening URL ${apiUrl}`)

    // Open system browser to the server's desktop OAuth endpoint.
    // The server initiates the OAuth flow so the browser has the state cookie.
    const oauthInitUrl =
      `${apiUrl}/oauth/desktop?provider=${encodeURIComponent(provider)}&port=${callbackServer.port}`
    shell.openExternal(oauthInitUrl)

    // Bring Electron back to front so user sees loading state
    setTimeout(() => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    }, 1000)

    try {
      const code = await callbackServer.waitForCode()
      if (!code) return null
      return await exchangeSessionCode(apiUrl, code)
    } finally {
      callbackServer.close()
    }
  })

  ipcMain.handle(
    'auth:social-link',
    async (_event, provider: string, sessionToken: string) => {
      const callbackServer = await startOAuthLinkCallbackServer()

      try {
        const apiUrl = `${import.meta.env.MAIN_VITE_API_BASE_URL || 'http://localhost:8787'}/api`
        const sessionCode = await requestSessionCode(apiUrl, sessionToken)
        if (!sessionCode) {
          return false
        }
        const linkUrl =
          `${apiUrl}/oauth/desktop-link?provider=${encodeURIComponent(provider)}` +
          `&port=${callbackServer.port}&session_code=${encodeURIComponent(sessionCode)}`
        shell.openExternal(linkUrl)

        setTimeout(() => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
          }
        }, 1000)

        return await callbackServer.waitForResult()
      } finally {
        callbackServer.close()
      }
    }
  )

  // Timer states updates from renderer for tray display (supports multiple timers)
  ipcMain.on(
    'timer:states-change',
    (
      _event,
      timers: { timerId: number; taskId: number; taskTitle: string; startTime: string }[]
    ) => {
      trayManager?.updateTimerStates(timers)
    }
  )

  createWindow()

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
  trayManager.setOnShowTaskDetail((taskId: number) => {
    mainWindow?.webContents.send('tray:show-task-detail', taskId)
  })

  // Initialize notification scheduler for task reminders
  notificationScheduler = new NotificationScheduler()
  notificationScheduler.setHandlers({
    onStartTimer: (taskId: number) => {
      // Notify renderer to refresh timers
      mainWindow?.webContents.send('notification:timer-started', taskId)
    },
    onStopTimer: (taskId: number, _timerId: number) => {
      // Notify renderer to refresh timers
      mainWindow?.webContents.send('notification:timer-stopped', taskId)
    },
    onShowTask: (taskId: number) => {
      // Show the main window and open task detail
      mainWindow?.show()
      mainWindow?.webContents.send('tray:show-task-detail', taskId)
    }
  })
  notificationScheduler.start()

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
