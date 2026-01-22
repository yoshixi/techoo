/**
 * Shared calendar utilities for CalendarView and TaskTimeRangePicker
 */
import type { Task } from '../gen/api'

// ============================================================================
// Constants
// ============================================================================

/** Total minutes in a day (24 hours * 60 minutes) */
export const MINUTES_PER_DAY = 24 * 60

/** Default task duration when endAt is not specified */
export const DEFAULT_DURATION_MINUTES = 30

/** Milliseconds in a day, used for date calculations */
export const DAY_MS = 24 * 60 * 60 * 1000

/** Start hour for the default visible window (6 AM) */
export const VISIBLE_START_HOUR = 6

/** End hour for the default visible window (8 PM for TaskTimeRangePicker) */
export const VISIBLE_END_HOUR_PICKER = 20

/** End hour for the default visible window (12 PM / noon for CalendarView) */
export const VISIBLE_END_HOUR_CALENDAR = 12

/** Minimum slot height in pixels to ensure readability */
export const MIN_SLOT_HEIGHT_PX = 4

/** Vertical offset to center hour labels with grid lines */
export const HOUR_LABEL_VERTICAL_OFFSET = 6

// ============================================================================
// Zoom Configuration
// ============================================================================

/** Minimum zoom level (50% = zoomed out, shows more time in less space) */
export const MIN_ZOOM = 0.5

/** Maximum zoom level (300% = zoomed in, shows less time in more detail) */
export const MAX_ZOOM = 3.0

/** Increment/decrement step for zoom controls */
export const ZOOM_STEP = 0.25

/** Default zoom level (100%) */
export const DEFAULT_ZOOM = 1.0

/**
 * Determines slot granularity (minutes per slot) based on zoom level.
 * Lower zoom levels use coarser slots for better overview,
 * higher zoom levels use finer slots for precise scheduling.
 *
 * @param zoom - Current zoom level (0.5 to 3.0)
 * @returns Minutes per time slot (30, 15, 10, or 5)
 */
export const getSlotMinutesForZoom = (zoom: number): number => {
  if (zoom <= 0.75) return 30  // 30 min slots when zoomed out (overview)
  if (zoom <= 1.5) return 15   // 15 min slots at default zoom
  if (zoom <= 2.25) return 10  // 10 min slots when zoomed in
  return 5                      // 5 min slots when fully zoomed in (precise)
}

/**
 * Calculates slot configuration based on zoom level.
 *
 * @param zoom - Current zoom level
 * @returns Object containing slotMinutes, slotsPerHour, and total slotCount
 */
export const getSlotConfig = (zoom: number): {
  slotMinutes: number
  slotsPerHour: number
  slotCount: number
} => {
  const slotMinutes = getSlotMinutesForZoom(zoom)
  return {
    slotMinutes,
    slotsPerHour: 60 / slotMinutes,
    slotCount: MINUTES_PER_DAY / slotMinutes
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Internal representation of a task positioned on the calendar grid.
 * Contains layout information for rendering (lane assignment, slot positions).
 */
export type TaskLayout = {
  task: Task
  /** Which day column (0 for day view, 0-6 for week view) */
  dayIndex: number
  /** Starting slot index (inclusive) */
  startSlot: number
  /** Ending slot index (exclusive) */
  endSlot: number
  /** Horizontal lane for overlapping tasks (0-based) */
  lane: number
  /** Total number of lanes in this time range */
  laneCount: number
  /** Parsed start date */
  startDate: Date
  /** Parsed/computed end date */
  endDate: Date
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Clamps a value between min and max bounds */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/** Returns midnight (00:00:00) of the given date */
export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

/**
 * Returns the Monday of the week containing the given date.
 * Week starts on Monday (ISO week).
 */
export const startOfWeek = (date: Date): Date => {
  const day = date.getDay()
  const diff = (day + 6) % 7 // Days since Monday
  const start = new Date(date)
  start.setDate(start.getDate() - diff)
  return startOfDay(start)
}

/** Adds (or subtracts) days from a date */
export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// ============================================================================
// Formatting Functions
// ============================================================================

/** Formats a date as "Mon, Jan 1" for day column headers */
export const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

/** Formats a week range as "Jan 1 - Jan 7" for week view header */
export const formatWeekLabel = (start: Date): string => {
  const end = addDays(start, 6)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel} - ${endLabel}`
}

/** Formats an hour as "09:00" for the time gutter */
export const formatHourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`

/** Formats a time range as "09:00 - 10:30" for task display */
export const formatTimeRange = (start: Date, end: Date): string =>
  `${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`

/**
 * Computes the end date for a task.
 * If endAt is provided and valid, uses that; otherwise defaults to start + DEFAULT_DURATION_MINUTES.
 */
export const computeTaskEnd = (start: Date, endAt?: string | null): Date => {
  if (endAt) {
    const parsed = new Date(endAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000)
}

// ============================================================================
// Grid Calculation Functions
// ============================================================================

/**
 * Converts a mouse event Y position to a slot index within a day column.
 *
 * @param event - The mouse event
 * @param column - The day column DOM element
 * @param slotHeight - Height of each slot in pixels
 * @param slotCount - Total number of slots in a day
 * @returns The slot index (0 to slotCount-1)
 */
export const getSlotIndexFromEvent = (
  event: MouseEvent,
  column: HTMLDivElement,
  slotHeight: number,
  slotCount: number
): number => {
  const rect = column.getBoundingClientRect()
  const offset = event.clientY - rect.top
  const clamped = clamp(offset, 0, rect.height - 1)
  return clamp(Math.floor(clamped / slotHeight), 0, slotCount - 1)
}

/**
 * Converts a slot index to a Date object.
 *
 * @param baseDate - The midnight date of the day
 * @param slot - The slot index
 * @param slotMinutes - Minutes per slot
 * @returns Date object at the start of that slot
 */
export const dateForSlot = (baseDate: Date, slot: number, slotMinutes: number): Date => {
  const minutes = slot * slotMinutes
  const result = new Date(baseDate)
  result.setMinutes(minutes, 0, 0)
  return result
}

/**
 * Assigns horizontal lanes to overlapping tasks using a greedy algorithm.
 * Tasks are sorted by start time, then assigned to the first available lane
 * that doesn't overlap with their time range.
 *
 * @param tasks - Array of TaskLayout items to assign lanes to
 * @returns The same tasks with lane and laneCount properties populated
 */
export const assignLanes = (tasks: TaskLayout[]): TaskLayout[] => {
  // Track the end slot of the last task in each lane
  const lanesEnd: number[] = []

  // Sort by start time (then by end time for same start)
  const sorted = [...tasks].sort((a, b) => {
    if (a.startSlot === b.startSlot) return a.endSlot - b.endSlot
    return a.startSlot - b.startSlot
  })

  sorted.forEach((item) => {
    // Find first lane where this task fits (no overlap)
    let laneIndex = lanesEnd.findIndex((endSlot) => item.startSlot >= endSlot)
    if (laneIndex === -1) {
      // No available lane, create a new one
      laneIndex = lanesEnd.length
      lanesEnd.push(item.endSlot)
    } else {
      // Reuse this lane and update its end slot
      lanesEnd[laneIndex] = item.endSlot
    }
    item.lane = laneIndex
  })

  // Set laneCount on all items so they know how wide to render
  const laneCount = Math.max(lanesEnd.length, 1)
  return sorted.map((item) => ({ ...item, laneCount }))
}

/**
 * Calculates task layouts for a given day.
 *
 * @param tasks - Array of tasks to layout
 * @param activeBase - The base date for the view (start of day or week)
 * @param dayCount - Number of days in the view (1 or 7)
 * @param slotMinutes - Minutes per slot
 * @param slotCount - Total number of slots
 * @returns Map of dayIndex to array of TaskLayout items
 */
export const calculateTaskLayouts = (
  tasks: Task[],
  activeBase: Date,
  dayCount: number,
  slotMinutes: number,
  slotCount: number
): Map<number, TaskLayout[]> => {
  const scheduledMap = new Map<number, TaskLayout[]>()

  tasks.forEach((task) => {
    if (!task.startAt) {
      return
    }

    const startDate = new Date(task.startAt)
    if (Number.isNaN(startDate.getTime())) {
      return
    }

    const endDateRaw = computeTaskEnd(startDate, task.endAt)
    const baseTime = startOfDay(activeBase).getTime()
    const startDayTime = startOfDay(startDate).getTime()
    const dayIndex = Math.round((startDayTime - baseTime) / DAY_MS)
    if (dayIndex < 0 || dayIndex >= dayCount) return

    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
    let endDate = endDateRaw
    if (endDate <= startDate) {
      endDate = new Date(startDate.getTime() + slotMinutes * 60 * 1000)
    }
    const endMinutesRaw = endDate.getHours() * 60 + endDate.getMinutes()
    const endMinutes = clamp(endMinutesRaw, 0, MINUTES_PER_DAY)

    const startSlot = clamp(Math.floor(startMinutes / slotMinutes), 0, slotCount - 1)
    const endSlot = clamp(Math.ceil(endMinutes / slotMinutes), startSlot + 1, slotCount)

    const entry: TaskLayout = {
      task,
      dayIndex,
      startSlot,
      endSlot,
      lane: 0,
      laneCount: 1,
      startDate,
      endDate
    }

    const list = scheduledMap.get(dayIndex) ?? []
    list.push(entry)
    scheduledMap.set(dayIndex, list)
  })

  const finalized = new Map<number, TaskLayout[]>()
  scheduledMap.forEach((list, dayIndex) => {
    finalized.set(dayIndex, assignLanes(list))
  })

  return finalized
}
