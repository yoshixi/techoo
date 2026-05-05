/**
 * Time formatting utilities for the mobile app
 */

/**
 * Format elapsed time in seconds to HH:MM:SS format
 */
export function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  const parts: string[] = []
  if (hours > 0) {
    parts.push(hours.toString().padStart(2, '0'))
  }
  parts.push(minutes.toString().padStart(2, '0'))
  parts.push(secs.toString().padStart(2, '0'))

  return parts.join(':')
}

/**
 * Format a date for display (e.g., "Jan 15, 2024")
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Format a time for display (e.g., "2:30 PM")
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/** UTC RFC3339 (`toISOString`) for API query/body datetime fields. */
export function toRfc3339(instant: Date): string {
  return instant.toISOString()
}

/** Todo list times — matches Electron `TodoView` (`hour`/`minute` 2-digit, locale default). */
export function formatTodoClockTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format a datetime for display (e.g., "Jan 15 at 2:30 PM")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (Math.abs(diffSecs) < 60) {
    return 'just now'
  }

  const isFuture = diffMs > 0

  if (Math.abs(diffMins) < 60) {
    const mins = Math.abs(diffMins)
    return isFuture ? `in ${mins} min` : `${mins} min ago`
  }

  if (Math.abs(diffHours) < 24) {
    const hours = Math.abs(diffHours)
    return isFuture ? `in ${hours}h` : `${hours}h ago`
  }

  if (Math.abs(diffDays) < 7) {
    const days = Math.abs(diffDays)
    return isFuture ? `in ${days}d` : `${days}d ago`
  }

  return formatDate(d)
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  )
}

/**
 * Get the start of a day
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the end of a day
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Calculate duration between two dates in seconds
 */
export function calculateDurationSeconds(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? new Date(start) : start
  const endDate = typeof end === 'string' ? new Date(end) : end
  return Math.floor((endDate.getTime() - startDate.getTime()) / 1000)
}
