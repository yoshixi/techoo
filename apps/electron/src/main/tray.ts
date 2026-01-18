import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'

interface TimerState {
  taskId: string
  taskTitle: string
  startTime: string
}

export class TrayManager {
  private tray: Tray | null = null
  private timerInterval: NodeJS.Timeout | null = null
  private currentTimerState: TimerState | null = null

  constructor(private getMainWindow: () => BrowserWindow | null) {}

  init(): void {
    const iconPath = this.getIconPath()
    const icon = nativeImage.createFromPath(iconPath)

    this.tray = new Tray(icon)
    this.tray.setToolTip('Shuchu - No active timer')
    this.updateContextMenu()

    this.tray.on('click', () => {
      this.showMainWindow()
    })
  }

  private getIconPath(): string {
    // macOS uses Template images for proper menu bar appearance (light/dark mode)
    if (process.platform === 'darwin') {
      return join(__dirname, '../../resources/tray-iconTemplate.png')
    }
    return join(__dirname, '../../resources/tray-icon.png')
  }

  private showMainWindow(): void {
    const mainWindow = this.getMainWindow()
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  }

  private updateContextMenu(): void {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    if (this.currentTimerState) {
      menuItems.push({
        label: `Timer: ${this.truncateTitle(this.currentTimerState.taskTitle, 30)}`,
        enabled: false
      })
      menuItems.push({ type: 'separator' })
    }

    menuItems.push({
      label: 'Show Shuchu',
      click: () => this.showMainWindow()
    })

    menuItems.push({ type: 'separator' })

    menuItems.push({
      label: 'Quit',
      click: () => app.quit()
    })

    const contextMenu = Menu.buildFromTemplate(menuItems)
    this.tray?.setContextMenu(contextMenu)
  }

  updateTimerState(state: TimerState | null): void {
    this.currentTimerState = state

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    if (state) {
      this.updateDisplay()
      this.timerInterval = setInterval(() => this.updateDisplay(), 1000)
    } else {
      this.clearDisplay()
    }

    this.updateContextMenu()
  }

  private updateDisplay(): void {
    if (!this.currentTimerState || !this.tray) return

    const elapsed = this.calculateElapsed(this.currentTimerState.startTime)
    const timeString = this.formatElapsed(elapsed)
    const taskTitle = this.truncateTitle(this.currentTimerState.taskTitle, 20)

    if (process.platform === 'darwin') {
      // macOS: Show time in menu bar title (next to icon)
      this.tray.setTitle(` ${timeString}`)
    }

    // All platforms: Update tooltip
    this.tray.setToolTip(`${taskTitle} - ${timeString}`)
  }

  private clearDisplay(): void {
    if (!this.tray) return

    if (process.platform === 'darwin') {
      this.tray.setTitle('')
    }
    this.tray.setToolTip('Shuchu - No active timer')
  }

  private calculateElapsed(startTime: string): number {
    const start = new Date(startTime).getTime()
    return Math.floor((Date.now() - start) / 1000)
  }

  private formatElapsed(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title
    return title.substring(0, maxLength - 1) + '...'
  }

  destroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.tray?.destroy()
    this.tray = null
  }
}
