import { shell, app, BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

// Custom protocol for OAuth callback
// Use different protocol in development to avoid conflicts with production builds
const PROTOCOL = is.dev ? 'shuchu-dev' : 'shuchu'
const CALLBACK_PATH = 'auth/callback'

// Export for renderer to use
export const REDIRECT_URI = `${PROTOCOL}://${CALLBACK_PATH}`

// Reference to main window for sending IPC messages
let mainWindow: BrowserWindow | null = null

/**
 * Set the main window reference for IPC communication.
 */
export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window
}

/**
 * Register the custom protocol handler.
 * Must be called before app is ready.
 */
export function registerProtocolHandler(): void {
  if (process.defaultApp) {
    // Development mode - need to register with electron executable path
    if (process.argv.length >= 2) {
      // Remove any existing protocol registration first (in case production build registered it)
      app.removeAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]])
      // Register the protocol for this dev instance
      const success = app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]])
      console.log(`Protocol ${PROTOCOL}:// registration (dev):`, success ? 'success' : 'failed')
      console.log('  execPath:', process.execPath)
      console.log('  argv[1]:', process.argv[1])
    }
  } else {
    // Production mode
    app.removeAsDefaultProtocolClient(PROTOCOL)
    const success = app.setAsDefaultProtocolClient(PROTOCOL)
    console.log(`Protocol ${PROTOCOL}:// registration (prod):`, success ? 'success' : 'failed')
  }
}

/**
 * Handle the OAuth callback URL.
 * Forwards the URL to the renderer process for Clerk SDK to handle.
 * Returns true if the URL was handled.
 */
export async function handleOAuthCallback(url: string): Promise<boolean> {
  if (!url.startsWith(`${PROTOCOL}://${CALLBACK_PATH}`)) {
    return false
  }

  // Forward the callback URL to renderer for Clerk SDK to process
  mainWindow?.webContents.send('auth:callback-url', url)
  return true
}

/**
 * Open a URL in the system browser.
 * Used for OAuth authorization flow.
 */
export async function openAuthUrl(url: string): Promise<void> {
  await shell.openExternal(url)
}
