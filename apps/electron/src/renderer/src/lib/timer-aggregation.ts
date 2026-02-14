import type { Task, TaskTimer } from '../gen/api'

export interface DailyTimerData {
  date: string
  hours: number
}

export interface TagTimerData {
  tagName: string
  hours: number
}

export interface TaskTimerSummary {
  task: Task
  totalMs: number
  sessionCount: number
}

function timerDurationMs(timer: TaskTimer): number {
  const start = new Date(timer.startTime).getTime()
  const end = timer.endTime ? new Date(timer.endTime).getTime() : Date.now()
  return Math.max(0, end - start)
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function aggregateDailyTimers(timers: TaskTimer[], days: number = 14): DailyTimerData[] {
  const now = new Date()
  const buckets = new Map<string, number>()

  // Initialize buckets for the last N days
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    buckets.set(formatDateKey(d), 0)
  }

  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)

  for (const timer of timers) {
    const start = new Date(timer.startTime)
    if (start < cutoff) continue

    const durationMs = timerDurationMs(timer)
    const key = formatDateKey(start)
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + durationMs)
    }
  }

  return Array.from(buckets.entries()).map(([date, ms]) => ({
    date,
    hours: Math.round((ms / 3600000) * 10) / 10
  }))
}

export function aggregateTimersByTag(
  tasks: Task[],
  timersByTaskId: Map<number, TaskTimer[]>
): TagTimerData[] {
  const tagTotals = new Map<string, number>()

  for (const task of tasks) {
    const taskTimers = timersByTaskId.get(task.id) ?? []
    const totalMs = taskTimers.reduce((sum, t) => sum + timerDurationMs(t), 0)
    if (totalMs === 0) continue

    const tags = task.tags && task.tags.length > 0 ? task.tags : [{ id: 0, name: 'Untagged' }]
    const perTagMs = totalMs / tags.length
    for (const tag of tags) {
      tagTotals.set(tag.name, (tagTotals.get(tag.name) ?? 0) + perTagMs)
    }
  }

  return Array.from(tagTotals.entries())
    .map(([tagName, ms]) => ({
      tagName,
      hours: Math.round((ms / 3600000) * 10) / 10
    }))
    .sort((a, b) => b.hours - a.hours)
}

export function aggregateTaskTimerSummaries(
  tasks: Task[],
  timersByTaskId: Map<number, TaskTimer[]>
): TaskTimerSummary[] {
  return tasks
    .map((task) => {
      const taskTimers = timersByTaskId.get(task.id) ?? []
      const totalMs = taskTimers.reduce((sum, t) => sum + timerDurationMs(t), 0)
      return { task, totalMs, sessionCount: taskTimers.length }
    })
    .filter((s) => s.sessionCount > 0)
    .sort((a, b) => b.totalMs - a.totalMs)
}

export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
