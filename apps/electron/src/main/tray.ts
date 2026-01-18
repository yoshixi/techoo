import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'

interface TimerState {
  timerId: string
  taskId: string
  taskTitle: string
  startTime: string
}

export class TrayManager {
  private tray: Tray | null = null
  private timerInterval: NodeJS.Timeout | null = null
  private activeTimers: TimerState[] = []
  private onShowTaskDetail: ((taskId: string) => void) | null = null

  constructor(private getMainWindow: () => BrowserWindow | null) {}

  init(): void {
    const iconPath = this.getIconPath()
    const icon = nativeImage.createFromPath(iconPath)

    this.tray = new Tray(icon)
    this.tray.setToolTip('Shuchu - No active timers')
    this.updateContextMenu()

    this.tray.on('click', () => {
      this.showMainWindow()
    })

    // macOS-only: show context menu on hover
    if (process.platform === 'darwin') {
      this.tray.on('mouse-enter', () => {
        this.tray?.popUpContextMenu()
      })
    }
  }

  setOnShowTaskDetail(callback: (taskId: string) => void): void {
    this.onShowTaskDetail = callback
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

    if (this.activeTimers.length > 0) {
      // Sort by most recent start time first
      const sortedTimers = [...this.activeTimers].sort((a, b) => {
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      })

      // Add each timer as a clickable row - clicking shows task detail
      for (const timer of sortedTimers) {
        const elapsed = this.calculateElapsed(timer.startTime)
        const timeString = this.formatElapsed(elapsed)
        const title = this.truncateTitle(timer.taskTitle, 25)

        menuItems.push({
          label: `${title}  ${timeString}`,
          click: () => {
            this.showMainWindow()
            this.onShowTaskDetail?.(timer.taskId)
          }
        })
      }

      menuItems.push({ type: 'separator' })
    } else {
      menuItems.push({
        label: 'No active timers',
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

  updateTimerStates(timers: TimerState[]): void {
    this.activeTimers = timers

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    if (timers.length > 0) {
      this.updateDisplay()
      // Update display and context menu every second
      this.timerInterval = setInterval(() => {
        this.updateDisplay()
        this.updateContextMenu()
      }, 1000)
    } else {
      this.clearDisplay()
    }

    this.updateContextMenu()
  }

  private updateDisplay(): void {
    if (!this.tray) return

    const count = this.activeTimers.length

    if (count === 0) {
      this.clearDisplay()
      return
    }

    if (process.platform === 'darwin') {
      // macOS: Show timer count in menu bar title
      if (count === 1) {
        this.tray.setTitle(' 1 timer')
      } else {
        this.tray.setTitle(` ${count} timers`)
      }
    }

    // Tooltip: show count and first task
    if (count === 1) {
      const timer = this.activeTimers[0]
      const elapsed = this.calculateElapsed(timer.startTime)
      const timeString = this.formatElapsed(elapsed)
      this.tray.setToolTip(`${timer.taskTitle} - ${timeString}`)
    } else {
      this.tray.setToolTip(`${count} active timers`)
    }
  }

  private clearDisplay(): void {
    if (!this.tray) return

    if (process.platform === 'darwin') {
      this.tray.setTitle('')
    }
    this.tray.setToolTip('Shuchu - No active timers')
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
    return title.substring(0, maxLength - 1) + '…'
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
