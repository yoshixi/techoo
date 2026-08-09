import { Notification, shell, systemPreferences } from 'electron'
import { spawn } from 'child_process'

const API_URL = import.meta.env.MAIN_VITE_API_BASE_URL || 'http://localhost:8787'
const POLL_INTERVAL_MS = 30 * 1000 // Poll every 30 seconds
const NOTIFY_BEFORE_MS = 60 * 1000 // Notify 1 minute before
const NEXT_TASK_WINDOW_MS = 30 * 60 * 1000 // 30 minutes window for next task

interface Todo {
  id: number
  title: string
  starts_at: string | null
  ends_at: string | null
  done: number
  done_at: string | null
}

interface NotificationRecord {
  type: 'start' | 'end'
  taskId: number
  timestamp: number
}

interface SnoozeRecord {
  type: 'start' | 'end'
  taskId: number
  todo: Todo
  nextTodo?: Todo
  notifyAt: number
}

type NotificationHandler = {
  onShowTask: (taskId: number) => void
}

export type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

export class NotificationScheduler {
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private sentNotifications: Map<string, NotificationRecord> = new Map()
  private snoozedNotifications: Map<string, SnoozeRecord> = new Map()
  private handlers: NotificationHandler | null = null
  private authToken: string | null = null

  setHandlers(handlers: NotificationHandler): void {
    this.handlers = handlers
  }

  setAuthToken(token: string | null): void {
    this.authToken = token
    if (token) {
      void this.checkSchedules()
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }
    return headers
  }

  /**
   * Check if notifications are supported and permission is granted
   */
  static isSupported(): boolean {
    return Notification.isSupported()
  }

  /**
   * Get current notification permission status
   * On macOS, uses systemPreferences to get actual OS-level permission
   * On other platforms, falls back to checking if notifications are supported
   */
  static getPermissionStatus(): NotificationPermissionStatus {
    if (!Notification.isSupported()) {
      return 'denied'
    }

    // On macOS, check actual notification authorization status
    if (process.platform === 'darwin') {
      // getNotificationSettings() is available in Electron 24+
      // Type assertion needed as TypeScript types may not include this method
      const getNotificationSettings = (
        systemPreferences as unknown as {
          getNotificationSettings?: () => { authorizationStatus: number }
        }
      ).getNotificationSettings

      if (getNotificationSettings) {
        const settings = getNotificationSettings()
        // authorizationStatus: 0 = notDetermined, 1 = denied, 2 = authorized, 3 = provisional
        switch (settings.authorizationStatus) {
          case 0:
            return 'not-determined'
          case 1:
            return 'denied'
          case 2:
          case 3: // provisional is treated as granted
            return 'granted'
          default:
            return 'not-determined'
        }
      }
    }

    // On Windows and Linux, assume granted if supported
    // (these platforms don't have the same permission model)
    return 'granted'
  }

  /**
   * Request notification permission (shows a test notification on some platforms)
   */
  static async requestPermission(): Promise<NotificationPermissionStatus> {
    if (!Notification.isSupported()) {
      return 'denied'
    }

    // On macOS, showing a notification will trigger the permission prompt if not determined
    if (process.platform === 'darwin') {
      const currentStatus = this.getPermissionStatus()
      if (currentStatus === 'not-determined') {
        // Show a test notification to trigger the permission prompt
        const notification = new Notification({
          title: 'Techo Notifications',
          body: 'Notifications are now enabled for task reminders',
          silent: true
        })
        notification.show()
      }
    }

    return this.getPermissionStatus()
  }

  /**
   * Open system notification settings
   */
  static openNotificationSettings(): void {
    if (process.platform === 'darwin') {
      // Open macOS notification settings
      shell.openExternal('x-apple.systempreferences:com.apple.preference.notifications')
    } else if (process.platform === 'win32') {
      // Open Windows notification settings
      shell.openExternal('ms-settings:notifications')
    } else {
      // Linux - spawn gnome-control-center directly (not a URL, so can't use openExternal)
      // Try GNOME settings first, fall back silently if not available
      const child = spawn('gnome-control-center', ['notifications'], {
        detached: true,
        stdio: 'ignore'
      })
      child.on('error', (error) => {
        console.warn('Failed to open notification settings:', error)
      })
      child.unref()
    }
  }

  start(): void {
    if (this.pollInterval) return

    // Check if notifications are allowed before starting
    const status = NotificationScheduler.getPermissionStatus()
    if (status !== 'granted') {
      console.log('Notifications not granted, scheduler will not send notifications')
    }

    // Initial check
    this.checkSchedules()

    // Poll periodically
    this.pollInterval = setInterval(() => {
      this.checkSchedules()
    }, POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  private async fetchTodos(): Promise<Todo[]> {
    if (!this.authToken) {
      return []
    }
    try {
      const response = await fetch(`${API_URL}/api/v1/todos?done=false&limit=500`, {
        headers: this.getAuthHeaders()
      })
      if (!response.ok) return []
      const body = (await response.json()) as { data: Todo[] }
      return body.data || []
    } catch (error) {
      console.error('Failed to fetch todos for notifications:', error)
      return []
    }
  }

  private getNotificationKey(type: 'start' | 'end', taskId: number): string {
    // Use date to allow same notification next day
    const dateKey = new Date().toISOString().split('T')[0]
    return `${type}-${taskId}-${dateKey}`
  }

  private hasNotified(type: 'start' | 'end', taskId: number): boolean {
    const key = this.getNotificationKey(type, taskId)
    return this.sentNotifications.has(key)
  }

  private markNotified(type: 'start' | 'end', taskId: number): void {
    const key = this.getNotificationKey(type, taskId)
    this.sentNotifications.set(key, {
      type,
      taskId,
      timestamp: Date.now()
    })

    // Cleanup old notifications (older than 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    for (const [k, record] of this.sentNotifications.entries()) {
      if (record.timestamp < dayAgo) {
        this.sentNotifications.delete(k)
      }
    }
  }

  private scheduleSnooze(
    type: 'start' | 'end',
    todo: Todo,
    delayMinutes: number,
    nextTodo?: Todo
  ): void {
    const key = `snooze-${type}-${todo.id}-${Date.now()}`
    const notifyAt = Date.now() + delayMinutes * 60 * 1000
    this.snoozedNotifications.set(key, {
      type,
      taskId: todo.id,
      todo,
      nextTodo,
      notifyAt
    })
  }

  private checkSnoozedNotifications(): void {
    const now = Date.now()
    for (const [key, snooze] of this.snoozedNotifications.entries()) {
      if (now >= snooze.notifyAt) {
        this.snoozedNotifications.delete(key)
        if (snooze.type === 'start') {
          this.showStartNotification(snooze.todo)
        } else if (snooze.nextTodo) {
          this.showEndWithNextNotification(snooze.todo, snooze.nextTodo)
        } else {
          this.showEndNotification(snooze.todo)
        }
      }
    }
  }

  private async checkSchedules(): Promise<void> {
    const now = Date.now()

    // Check snoozed notifications first
    this.checkSnoozedNotifications()

    if (!this.authToken) {
      return
    }

    const todos = await this.fetchTodos()

    for (const todo of todos) {
      // Skip completed todos
      if (todo.done === 1 || todo.done_at) continue

      // Todo about to start
      if (todo.starts_at) {
        const startTime = new Date(todo.starts_at).getTime()
        const timeUntilStart = startTime - now

        if (timeUntilStart > 0 && timeUntilStart <= NOTIFY_BEFORE_MS) {
          if (!this.hasNotified('start', todo.id)) {
            this.showStartNotification(todo)
            this.markNotified('start', todo.id)
          }
        }
      }

      // Todo about to end (scheduled end time)
      if (todo.ends_at) {
        const endTime = new Date(todo.ends_at).getTime()
        const timeUntilEnd = endTime - now

        if (timeUntilEnd > 0 && timeUntilEnd <= NOTIFY_BEFORE_MS) {
          if (!this.hasNotified('end', todo.id)) {
            const nextTodo = this.findNextTodo(todos, todo, endTime)
            if (nextTodo) {
              this.showEndWithNextNotification(todo, nextTodo)
            } else {
              this.showEndNotification(todo)
            }
            this.markNotified('end', todo.id)
          }
        }
      }
    }
  }

  private findNextTodo(todos: Todo[], currentTodo: Todo, currentEndTime: number): Todo | null {
    const candidates = todos.filter((t) => {
      if (t.id === currentTodo.id) return false
      if (t.done === 1 || t.done_at) return false
      if (!t.starts_at) return false

      const todoStartTime = new Date(t.starts_at).getTime()
      const timeBetween = todoStartTime - currentEndTime

      // Next todo should start within 30 minutes after current todo ends
      return timeBetween >= 0 && timeBetween <= NEXT_TASK_WINDOW_MS
    })

    // Return the earliest upcoming todo
    if (candidates.length === 0) return null

    return candidates.reduce((earliest, todo) => {
      const earliestStart = new Date(earliest.starts_at!).getTime()
      const todoStart = new Date(todo.starts_at!).getTime()
      return todoStart < earliestStart ? todo : earliest
    })
  }

  private showStartNotification(todo: Todo): void {
    const notification = new Notification({
      title: 'Task Starting Soon',
      body: `"${todo.title}" is about to start`,
      silent: false,
      timeoutType: 'never',
      actions: [
        { type: 'button', text: 'Snooze 5m' },
        { type: 'button', text: 'Snooze 15m' },
        { type: 'button', text: 'Snooze 30m' }
      ]
    })

    notification.on('click', () => {
      this.handlers?.onShowTask(todo.id)
    })

    notification.on('action', (_event, index) => {
      switch (index) {
        case 0:
          this.scheduleSnooze('start', todo, 5)
          break
        case 1:
          this.scheduleSnooze('start', todo, 15)
          break
        case 2:
          this.scheduleSnooze('start', todo, 30)
          break
      }
    })

    notification.show()
  }

  private showEndNotification(todo: Todo): void {
    const notification = new Notification({
      title: 'Task Ending Soon',
      body: `"${todo.title}" is about to end`,
      silent: false,
      timeoutType: 'never',
      actions: [
        { type: 'button', text: 'Snooze 5m' },
        { type: 'button', text: 'Snooze 15m' },
        { type: 'button', text: 'Snooze 30m' }
      ]
    })

    notification.on('click', () => {
      this.handlers?.onShowTask(todo.id)
    })

    notification.on('action', (_event, index) => {
      switch (index) {
        case 0:
          this.scheduleSnooze('end', todo, 5)
          break
        case 1:
          this.scheduleSnooze('end', todo, 15)
          break
        case 2:
          this.scheduleSnooze('end', todo, 30)
          break
      }
    })

    notification.show()
  }

  private showEndWithNextNotification(currentTodo: Todo, nextTodo: Todo): void {
    const notification = new Notification({
      title: 'Task Ending Soon',
      body: `"${currentTodo.title}" ending. Next: "${nextTodo.title}"`,
      silent: false,
      timeoutType: 'never',
      actions: [
        { type: 'button', text: 'Snooze 5m' },
        { type: 'button', text: 'Snooze 15m' },
        { type: 'button', text: 'Snooze 30m' }
      ]
    })

    notification.on('click', () => {
      this.handlers?.onShowTask(currentTodo.id)
    })

    notification.on('action', (_event, index) => {
      switch (index) {
        case 0:
          this.scheduleSnooze('end', currentTodo, 5, nextTodo)
          break
        case 1:
          this.scheduleSnooze('end', currentTodo, 15, nextTodo)
          break
        case 2:
          this.scheduleSnooze('end', currentTodo, 30, nextTodo)
          break
      }
    })

    notification.show()
  }
}
