/** Client-held palette for calendar event colors. */
export const CALENDAR_COLOR_PALETTE = [
  '#4285F4',
  '#EA4335',
  '#34A853',
  '#FBBC05',
  '#9C27B0',
  '#00ACC1',
  '#F4511E',
  '#7986CB',
  '#0B8043',
  '#D50000',
  '#33B679',
  '#8E24AA',
] as const

export const CALENDAR_COLORS_STORAGE_KEY = 'techoo:calendar-colors'

/** Normalize to `#RRGGBB` for event styling that appends an alpha suffix. */
export function normalizeHexColor(color: string): string | null {
  const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color.trim())
  if (!match) return null
  return `#${match[1].toUpperCase()}`
}

/**
 * Picks a random palette color, preferring ones not already in use.
 * `random` is injected so assignment stays testable (no Math.random in tests).
 */
export function pickRandomCalendarColor(
  usedColors: Iterable<string>,
  random: () => number
): string {
  const used = new Set(usedColors)
  const unused = CALENDAR_COLOR_PALETTE.filter((color) => !used.has(color))
  const pool = unused.length > 0 ? unused : [...CALENDAR_COLOR_PALETTE]
  const index = Math.floor(random() * pool.length)
  return pool[Math.min(index, pool.length - 1)]
}

/**
 * Keeps persisted colors (including ids not in this batch) and randomly
 * assigns palette colors to newly seen ids. Does not prune — a filtered
 * calendar list must not wipe colors for other accounts.
 */
export function mergeCalendarColors(
  calendarIds: string[],
  existing: Record<string, string>,
  random: () => number
): Record<string, string> {
  const next = { ...existing }
  const usedAmongBatch = calendarIds
    .map((id) => next[id])
    .filter((color): color is string => Boolean(color))

  for (const id of calendarIds) {
    if (next[id]) continue
    const color = pickRandomCalendarColor(usedAmongBatch, random)
    next[id] = color
    usedAmongBatch.push(color)
  }
  return next
}

export function calendarColorsEqual(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}
