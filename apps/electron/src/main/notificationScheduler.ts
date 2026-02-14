import { Notification, shell, systemPreferences } from 'electron'
import { spawn } from 'child_process'

const API_URL = import.meta.env.MAIN_VITE_API_BASE_URL || 'http://localhost:8787'
const POLL_INTERVAL_MS = 30 * 1000 // Poll every 30 seconds
const NOTIFY_BEFORE_MS = 60 * 1000 // Notify 1 minute before
const NEXT_TASK_WINDOW_MS = 30 * 60 * 1000 // 30 minutes window for next task

interface Task {
  id: number
  title: string
  startAt: string | null
  endAt: string | null
  completedAt: string | null
}

interface TaskTimer {
  id: number
  taskId: number
  startTime: string
  endTime: string | null
}

interface NotificationRecord {
  type: 'start' | 'end'
  taskId: number
  timestamp: number
}

interface SnoozeRecord {
  type: 'start' | 'end'
  taskId: number
  task: Task
  timerId?: number
  nextTask?: Task
  notifyAt: number
}

type NotificationHandler = {
  onStartTimer: (taskId: number) => void
  onStopTimer: (taskId: number, timerId: number) => void
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
          title: 'Shuchu Notifications',
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

  private async fetchTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${API_URL}/api/tasks?completed=false`, {
        headers: this.getAuthHeaders()
      })
      if (!response.ok) return []
      const data = (await response.json()) as { tasks: Task[] }
      return data.tasks || []
    } catch (error) {
      console.error('Failed to fetch tasks for notifications:', error)
      return []
    }
  }

  private async fetchActiveTimers(): Promise<TaskTimer[]> {
    try {
      const response = await fetch(`${API_URL}/api/timers`, {
        headers: this.getAuthHeaders()
      })
      if (!response.ok) return []
      const data = (await response.json()) as { timers: TaskTimer[] }
      // Filter to only active timers (no endTime)
      return (data.timers || []).filter((t) => !t.endTime)
    } catch (error) {
      console.error('Failed to fetch timers for notifications:', error)
      return []
    }
  }

  private async startTimer(taskId: number): Promise<void> {
    try {
      await fetch(`${API_URL}/api/timers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
        body: JSON.stringify({
          taskId,
          startTime: new Date().toISOString()
        })
      })
      // Notify renderer to refresh
      this.handlers?.onStartTimer(taskId)
    } catch (error) {
      console.error('Failed to start timer from notification:', error)
    }
  }

  private async stopTimer(taskId: number, timerId: number): Promise<void> {
    try {
      await fetch(`${API_URL}/api/timers/${timerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
        body: JSON.stringify({
          endTime: new Date().toISOString()
        })
      })
      // Notify renderer to refresh
      this.handlers?.onStopTimer(taskId, timerId)
    } catch (error) {
      console.error('Failed to stop timer from notification:', error)
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
    task: Task,
    delayMinutes: number,
    timerId?: number,
    nextTask?: Task
  ): void {
    const key = `snooze-${type}-${task.id}-${Date.now()}`
    const notifyAt = Date.now() + delayMinutes * 60 * 1000
    this.snoozedNotifications.set(key, {
      type,
      taskId: task.id,
      task,
      timerId,
      nextTask,
      notifyAt
    })
  }

  private checkSnoozedNotifications(): void {
    const now = Date.now()
    for (const [key, snooze] of this.snoozedNotifications.entries()) {
      if (now >= snooze.notifyAt) {
        this.snoozedNotifications.delete(key)
        if (snooze.type === 'start') {
          this.showStartNotification(snooze.task)
        } else if (snooze.nextTask && snooze.timerId) {
          this.showEndWithNextNotification(snooze.task, snooze.nextTask, snooze.timerId)
        } else if (snooze.timerId) {
          this.showEndNotification(snooze.task, snooze.timerId)
        }
      }
    }
  }

  private async checkSchedules(): Promise<void> {
    const now = Date.now()

    // Check snoozed notifications first
    this.checkSnoozedNotifications()

    const tasks = await this.fetchTasks()
    const activeTimers = await this.fetchActiveTimers()
    const activeTimerTaskIds = new Set(activeTimers.map((t) => t.taskId))

    for (const task of tasks) {
      // Skip completed tasks
      if (task.completedAt) continue

      const hasActiveTimer = activeTimerTaskIds.has(task.id)
      const activeTimer = activeTimers.find((t) => t.taskId === task.id)

      // Case 1: Task about to start (no active timer)
      if (task.startAt && !hasActiveTimer) {
        const startTime = new Date(task.startAt).getTime()
        const timeUntilStart = startTime - now

        // Notify if within 1 minute before start time
        if (timeUntilStart > 0 && timeUntilStart <= NOTIFY_BEFORE_MS) {
          if (!this.hasNotified('start', task.id)) {
            this.showStartNotification(task)
            this.markNotified('start', task.id)
          }
        }
      }

      // Case 2 & 3: Task about to end (has active timer)
      if (task.endAt && hasActiveTimer && activeTimer) {
        const endTime = new Date(task.endAt).getTime()
        const timeUntilEnd = endTime - now

        // Notify if within 1 minute before end time
        if (timeUntilEnd > 0 && timeUntilEnd <= NOTIFY_BEFORE_MS) {
          if (!this.hasNotified('end', task.id)) {
            // Find next task within 30 minutes
            const nextTask = this.findNextTask(tasks, task, endTime)
            if (nextTask) {
              // Case 3: Has next task
              this.showEndWithNextNotification(task, nextTask, activeTimer.id)
            } else {
              // Case 2: No next task
              this.showEndNotification(task, activeTimer.id)
            }
            this.markNotified('end', task.id)
          }
        }
      }
    }
  }

  private findNextTask(tasks: Task[], currentTask: Task, currentEndTime: number): Task | null {
    const candidates = tasks.filter((t) => {
      if (t.id === currentTask.id) return false
      if (t.completedAt) return false
      if (!t.startAt) return false

      const taskStartTime = new Date(t.startAt).getTime()
      const timeBetween = taskStartTime - currentEndTime

      // Next task should start within 30 minutes after current task ends
      return timeBetween >= 0 && timeBetween <= NEXT_TASK_WINDOW_MS
    })

    // Return the earliest upcoming task
    if (candidates.length === 0) return null

    return candidates.reduce((earliest, task) => {
      const earliestStart = new Date(earliest.startAt!).getTime()
      const taskStart = new Date(task.startAt!).getTime()
      return taskStart < earliestStart ? task : earliest
    })
  }

  private showStartNotification(task: Task): void {
    const notification = new Notification({
      title: 'Task Starting Soon',
      body: `"${task.title}" is about to start`,
      silent: false,
      timeoutType: 'never',
      actions: [
        { type: 'button', text: 'Start Timer' },
        { type: 'button', text: 'Snooze 5m' },
        { type: 'button', text: 'Snooze 15m' },
        { type: 'button', text: 'Snooze 30m' }
      ]
    })

    notification.on('click', () => {
      this.handlers?.onShowTask(task.id)
    })

    notification.on('action', (_event, index) => {
      switch (index) {
        case 0:
          // Start Timer
          this.startTimer(task.id)
          break
        case 1:
          // Snooze 5 minutes
          this.scheduleSnooze('start', task, 5)
          break
        case 2:
          // Snooze 15 minutes
          this.scheduleSnooze('start', task, 15)
          break
        case 3:
          // Snooze 30 minutes
          this.scheduleSnooze('start', task, 30)
          break
      }
    })

    notification.show()
  }

  private showEndNotification(task: Task, timerId: number): void {
    const notification = new Notification({
      title: 'Task Ending Soon',
      body: `"${task.title}" is about to end`,
      silent: false,
      timeoutType: 'never',
      actions: [
        { type: 'button', text: 'Stop Timer' },
        { type: 'button', text: 'Snooze 5m' },
        { type: 'button', text: 'Snooze 15m' },
        { type: 'button', text: 'Snooze 30m' }
      ]
    })

    notification.on('click', () => {
      this.handlers?.onShowTask(task.id)
    })

    notification.on('action', (_event, index) => {
      switch (index) {
        case 0:
          // Stop Timer
          this.stopTimer(task.id, timerId)
          break
        case 1:
          // Snooze 5 minutes
          this.scheduleSnooze('end', task, 5, timerId)
          break
        case 2:
          // Snooze 15 minutes
          this.scheduleSnooze('end', task, 15, timerId)
          break
        case 3:
          // Snooze 30 minutes
          this.scheduleSnooze('end', task, 30, timerId)
          break
      }
    })

    notification.show()
  }

  private showEndWithNextNotification(
    currentTask: Task,
    nextTask: Task,
    currentTimerId: number
  ): void {
    const notification = new Notification({
      title: 'Task Ending Soon',
      body: `"${currentTask.title}" ending. Next: "${nextTask.title}"`,
      silent: false,
      timeoutType: 'never',
      actions: [
        { type: 'button', text: 'Stop Only' },
        { type: 'button', text: 'Stop & Start Next' },
        { type: 'button', text: 'Snooze 5m' },
        { type: 'button', text: 'Snooze 15m' },
        { type: 'button', text: 'Snooze 30m' }
      ]
    })

    notification.on('click', () => {
      this.handlers?.onShowTask(currentTask.id)
    })

    notification.on('action', async (_event, index) => {
      switch (index) {
        case 0:
          // Stop current task only
          await this.stopTimer(currentTask.id, currentTimerId)
          break
        case 1:
          // Stop current and start next
          await this.stopTimer(currentTask.id, currentTimerId)
          await this.startTimer(nextTask.id)
          break
        case 2:
          // Snooze 5 minutes
          this.scheduleSnooze('end', currentTask, 5, currentTimerId, nextTask)
          break
        case 3:
          // Snooze 15 minutes
          this.scheduleSnooze('end', currentTask, 15, currentTimerId, nextTask)
          break
        case 4:
          // Snooze 30 minutes
          this.scheduleSnooze('end', currentTask, 30, currentTimerId, nextTask)
          break
      }
    })

    notification.show()
  }
}
