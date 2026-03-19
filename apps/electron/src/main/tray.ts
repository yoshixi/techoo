import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'

const API_URL = import.meta.env.MAIN_VITE_API_BASE_URL || 'http://localhost:8787'

interface TimerState {
  timerId: number
  taskId: number
  taskTitle: string
  startTime: string
}

interface ScheduledTask {
  id: number
  title: string
  startAt: string
}

export class TrayManager {
  private tray: Tray | null = null
  private timerInterval: NodeJS.Timeout | null = null
  private nextTaskInterval: NodeJS.Timeout | null = null
  private activeTimers: TimerState[] = []
  private nextTask: ScheduledTask | null = null
  private onShowTaskDetail: ((taskId: number) => void) | null = null
  private authToken: string | null = null

  constructor(private getMainWindow: () => BrowserWindow | null) {}

  setAuthToken(token: string | null): void {
    this.authToken = token
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }
    return headers
  }

  init(): void {
    const iconPath = this.getIconPath()
    const icon = nativeImage.createFromPath(iconPath)

    this.tray = new Tray(icon)
    this.tray.setToolTip('Techoo - No active timers')
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

    // Start fetching next scheduled task
    this.fetchNextTask()
    this.nextTaskInterval = setInterval(() => {
      this.fetchNextTask()
    }, 60 * 1000) // Refresh every minute
  }

  private async fetchNextTask(): Promise<void> {
    try {
      const response = await fetch(
        `${API_URL}/api/tasks?completed=false&scheduled=true&sortBy=startAt&order=asc`,
        { headers: this.getAuthHeaders() }
      )
      if (!response.ok) {
        this.nextTask = null
        return
      }
      const data = (await response.json()) as { tasks: ScheduledTask[] }
      const tasks = data.tasks || []

      // Find the next upcoming task (startAt in the future)
      const now = Date.now()
      const activeTaskIds = new Set(this.activeTimers.map((t) => t.taskId))

      const upcomingTask = tasks.find((task) => {
        if (!task.startAt) return false
        if (activeTaskIds.has(task.id)) return false // Skip tasks with active timers
        const startTime = new Date(task.startAt).getTime()
        return startTime > now
      })

      this.nextTask = upcomingTask || null
      this.updateDisplay()
      this.updateContextMenu()
    } catch (error) {
      console.error('Failed to fetch next task for tray:', error)
      this.nextTask = null
    }
  }

  setOnShowTaskDetail(callback: (taskId: number) => void): void {
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
          label: `▶ ${title}  ${timeString}`,
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

    // Show next scheduled task
    if (this.nextTask) {
      const startTime = new Date(this.nextTask.startAt)
      const timeString = startTime.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      })
      const title = this.truncateTitle(this.nextTask.title, 25)

      menuItems.push({
        label: `Next: ${title} at ${timeString}`,
        click: () => {
          this.showMainWindow()
          this.onShowTaskDetail?.(this.nextTask!.id)
        }
      })
      menuItems.push({ type: 'separator' })
    }

    menuItems.push({
      label: 'Show Techoo',
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

    // Refresh next task when timer states change
    this.fetchNextTask()

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
      // macOS: Show task name and elapsed time in menu bar
      // Sort by most recent start time first
      const sortedTimers = [...this.activeTimers].sort((a, b) => {
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      })
      const mostRecentTimer = sortedTimers[0]
      const elapsed = this.calculateElapsed(mostRecentTimer.startTime)
      const timeString = this.formatElapsedShort(elapsed)
      const truncatedTitle = this.truncateTitle(mostRecentTimer.taskTitle, 10)

      if (count === 1) {
        this.tray.setTitle(` ${truncatedTitle}: ${timeString}`)
      } else {
        // Show most recent task + indicator of additional timers
        this.tray.setTitle(` ${truncatedTitle}: ${timeString} (+${count - 1})`)
      }
    }

    // Tooltip: show full details
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
    this.tray.setToolTip('Techoo - No active timers')
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

  private formatElapsedShort(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    // Always show mm:ss format for menu bar
    if (h > 0) {
      const totalMinutes = h * 60 + m
      return `${totalMinutes.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
    if (this.nextTaskInterval) {
      clearInterval(this.nextTaskInterval)
      this.nextTaskInterval = null
    }
    this.tray?.destroy()
    this.tray = null
  }
}
