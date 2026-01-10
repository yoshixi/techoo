/**
 * Time and date utility functions for formatting and normalizing dates
 */

/**
 * Format ISO datetime string to YYYY-MM-DD for date input
 * @param value ISO 8601 datetime string
 * @returns YYYY-MM-DD formatted string or empty string if invalid
 */
export function formatDateInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

/**
 * Format ISO datetime string to YYYY-MM-DDTHH:mm for datetime-local input
 * @param value ISO 8601 datetime string
 * @returns YYYY-MM-DDTHH:mm formatted string or empty string if invalid
 */
export function formatDateTimeInput(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Format ISO datetime string to localized date and time display
 * @param value ISO 8601 datetime string
 * @returns Formatted string like "Mon, Jan 15, 2:30 PM" or original value if invalid
 */
export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Normalize date input (YYYY-MM-DD) to ISO 8601 datetime string at UTC midnight
 * @param value Date string in YYYY-MM-DD format
 * @returns ISO 8601 datetime string or undefined if invalid
 */
export function normalizeDueDate(value?: string | null): string | undefined {
  if (!value) return undefined
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/
  if (isoDatePattern.test(value)) {
    const [year, month, day] = value.split('-')
    const utcDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    return utcDate.toISOString()
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

/**
 * Normalize datetime-local input to ISO 8601 datetime string
 * @param value Datetime string from datetime-local input
 * @returns ISO 8601 datetime string or undefined if invalid
 */
export function normalizeDateTime(value?: string | null): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}
