/**
 * CalendarView.tsx
 *
 * A day/week calendar timeline component for visualizing and managing scheduled todos.
 *
 * Features:
 * - Day and week view modes with navigation
 * - Drag-to-create new time ranges on empty space
 * - Drag-to-move existing todos to different times/days
 * - Drag-to-resize todos from top or bottom edges
 * - Zoom in/out with buttons or Cmd/Ctrl + scroll wheel
 * - Dynamic slot granularity that adjusts based on zoom level
 * - Current time indicator with auto-scroll on mount
 * - Lane-based layout for overlapping todos
 */
import React, { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogContent } from './ui/dialog'
import { cn } from '../lib/utils'
import { useTodos } from '../hooks/useTodos'
import {
  MINUTES_PER_DAY,
  DAY_MS,
  MIN_SLOT_HEIGHT_PX,
  BASE_SLOT_HEIGHT_PX,
  HOUR_LABEL_VERTICAL_OFFSET,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  DEFAULT_ZOOM,
  getSlotConfig,
  clamp,
  startOfDay,
  startOfWeek,
  addDays,
  formatDayLabel,
  formatWeekLabel,
  formatHourLabel,
  formatTimeRange,
  getSlotIndexFromEvent,
  dateForSlot,
  type TaskLayout,
  type CalendarEventLayout
} from '../lib/calendar-utils'

// ============================================================================
// Types
// ============================================================================

/** A todo item from the new data model */
export interface Todo {
  id: number
  title: string
  description?: string | null
  starts_at: number | null
  ends_at: number | null
  is_all_day: number
  done: number
  done_at: number | null
  created_at: number
}

/** Calendar event displayed alongside todos */
export interface CalendarEvent {
  id: number
  title: string
  description: string | null
  startAt: string
  endAt: string
  isAllDay: number
  providerEventId: string
}

/** Calendar view mode: single day or full week */
export type ViewMode = 'day' | 'week'

// ============================================================================
// Helpers: Todo <-> Task adapter
// ============================================================================

/**
 * Converts a Unix timestamp (seconds) to an ISO string.
 * Returns null if the timestamp is null/undefined/0.
 */
function unixToISO(ts: number | null | undefined): string | null {
  if (ts == null || ts === 0) return null
  return new Date(ts * 1000).toISOString()
}

/**
 * Converts an ISO string to a Unix timestamp (seconds).
 */
function isoToUnix(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

/**
 * Adapts a Todo into the Task shape expected by calendar-utils.
 * This avoids having to rewrite all the layout logic.
 */
function todoToTask(todo: Todo): {
  id: number
  title: string
  startAt: string | null
  endAt: string | null
  completedAt: string | null
} {
  return {
    id: Number(todo.id) || 0, // TaskLayout expects number id; we use 0 as fallback
    title: todo.title,
    startAt: unixToISO(todo.starts_at),
    endAt: unixToISO(todo.ends_at),
    completedAt: todo.done === 1 ? (unixToISO(todo.done_at) ?? new Date().toISOString()) : null
  }
}

/** Default task duration when endAt is not specified (30 minutes) */
const DEFAULT_DURATION_MINUTES = 30

/**
 * Computes the end date for a task.
 */
const computeTaskEnd = (start: Date, endAt?: string | null): Date => {
  if (endAt) {
    const parsed = new Date(endAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000)
}

// ============================================================================
// Layout types using Todo instead of Task
// ============================================================================

/** Layout item that carries the original Todo reference */
type TodoLayout = Omit<TaskLayout, 'task'> & {
  todo: Todo
  /** The adapted task object (for internal layout math) */
  task: ReturnType<typeof todoToTask>
}

// ============================================================================
// Lane assignment (duplicated locally to work with TodoLayout)
// ============================================================================

function assignTodoLanes(items: TodoLayout[]): TodoLayout[] {
  const lanesEnd: number[] = []
  const sorted = [...items].sort((a, b) => {
    if (a.startSlot === b.startSlot) return a.endSlot - b.endSlot
    return a.startSlot - b.startSlot
  })
  sorted.forEach((item) => {
    let laneIndex = lanesEnd.findIndex((endSlot) => item.startSlot >= endSlot)
    if (laneIndex === -1) {
      laneIndex = lanesEnd.length
      lanesEnd.push(item.endSlot)
    } else {
      lanesEnd[laneIndex] = item.endSlot
    }
    item.lane = laneIndex
  })
  const laneCount = Math.max(lanesEnd.length, 1)
  return sorted.map((item) => ({ ...item, laneCount }))
}

// ============================================================================
// Props
// ============================================================================

/** Props for the CalendarView component */
type CalendarViewProps = {
  /** Array of todos to display on the calendar */
  todos?: Todo[]
  /** Controlled view mode (day or week) */
  viewMode?: ViewMode
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void
  /** Callback when a todo is clicked (for viewing details) */
  onTodoSelect?: (todo: Todo) => void
  /** Callback when edit button is clicked on a todo */
  onTodoEdit?: (todo: Todo) => void
  /** Callback when delete button is clicked on a todo */
  onTodoDelete?: (todo: Todo) => void
  /** Callback when a todo is dragged to a new time/day */
  onTodoMove?: (todo: Todo, range: { starts_at: number; ends_at: number }) => void
  /** Callback when user drags to create a new time range */
  onCreateRange?: (range: { starts_at: number; ends_at: number }) => void
  /** Callback when the visible anchor day changes via navigation */
  onAnchorDateChange?: (date: Date) => void
  /** Calendar events to display */
  calendarEvents?: CalendarEvent[]
  /** Hide the header bar (navigation, zoom, view mode buttons) */
  hideHeader?: boolean
  /** Extra controls on the right side of the header (e.g. “New”); avoids overlapping the toolbar */
  headerTrailing?: React.ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * CalendarView
 * - Day/week timeline that lays out all scheduled todos.
 * - Drag empty space to create a new time range (onCreateRange).
 * - Drag an existing todo to move its time range (onTodoMove).
 */
export function CalendarViewInner({
  todos = [],
  viewMode: viewModeProp,
  onViewModeChange,
  onTodoSelect,
  onTodoEdit,
  onTodoDelete,
  onTodoMove,
  onCreateRange,
  onAnchorDateChange,
  calendarEvents = [],
  hideHeader,
  headerTrailing,
  className
}: CalendarViewProps = {}): React.JSX.Element {
  // ==========================================================================
  // State: View Mode (controlled or uncontrolled)
  // ==========================================================================
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('day')
  const viewMode = viewModeProp ?? internalViewMode
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      onViewModeChange?.(mode)
      if (viewModeProp === undefined) {
        setInternalViewMode(mode)
      }
    },
    [onViewModeChange, viewModeProp]
  )

  // ==========================================================================
  // State: Navigation & Time
  // ==========================================================================
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()))
  const [now, setNow] = useState<Date>(() => new Date())

  // ==========================================================================
  // State: Zoom & Slot Configuration
  // ==========================================================================
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM)
  const slotHeight = Math.max(MIN_SLOT_HEIGHT_PX, Math.round(BASE_SLOT_HEIGHT_PX * zoomLevel))

  const slotConfig = useMemo(() => getSlotConfig(zoomLevel), [zoomLevel])
  const { slotMinutes, slotsPerHour, slotCount } = slotConfig

  // ==========================================================================
  // State: Drag Operations
  // ==========================================================================
  const [dragSelection, setDragSelection] = useState<{
    dayIndex: number
    startSlot: number
    endSlot: number
  } | null>(null)

  const [dragTask, setDragTask] = useState<{
    todo: Todo
    dayIndex: number
    durationSlots: number
    offsetSlots: number
    startSlot: number
  } | null>(null)

  const [dragResize, setDragResize] = useState<{
    todo: Todo
    dayIndex: number
    startSlot: number
    endSlot: number
    edge: 'top' | 'bottom'
  } | null>(null)

  const [didDragTask, setDidDragTask] = useState(false)

  // ==========================================================================
  // Refs
  // ==========================================================================
  const activeColumnRef = React.useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

  // ==========================================================================
  // Zoom Handlers
  // ==========================================================================
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  }, [])

  // ==========================================================================
  // Effect: Cmd/Ctrl + Scroll Wheel Zoom
  // ==========================================================================
  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent): void => {
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      if (event.deltaY < 0) {
        setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
      } else if (event.deltaY > 0) {
        setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // ==========================================================================
  // Derived Values: Date Calculations
  // ==========================================================================
  const dayStart = useMemo(() => startOfDay(anchorDate), [anchorDate])
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const activeBase = viewMode === 'day' ? dayStart : weekStart
  const dayCount = viewMode === 'day' ? 1 : 7

  React.useEffect(() => {
    onAnchorDateChange?.(dayStart)
  }, [dayStart, onAnchorDateChange])

  // ==========================================================================
  // Memoized: Todo Layout Calculation
  // ==========================================================================
  const scheduledByDay = useMemo(() => {
    const scheduledMap = new Map<number, TodoLayout[]>()

    todos.forEach((todo) => {
      if (!todo.starts_at) return

      const task = todoToTask(todo)
      if (!task.startAt) return

      const startDate = new Date(task.startAt)
      if (Number.isNaN(startDate.getTime())) return

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

      const entry: TodoLayout = {
        todo,
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

    const finalized = new Map<number, TodoLayout[]>()
    scheduledMap.forEach((list, dayIndex) => {
      finalized.set(dayIndex, assignTodoLanes(list))
    })

    return finalized
  }, [todos, activeBase, dayCount, slotMinutes, slotCount])

  // ==========================================================================
  // Memoized: Calendar Event Layout Calculation
  // ==========================================================================
  const eventsByDay = useMemo(() => {
    if (calendarEvents.length === 0) {
      return new Map<number, CalendarEventLayout[]>()
    }

    const scheduledMap = new Map<number, CalendarEventLayout[]>()

    calendarEvents.forEach((event) => {
      if (event.isAllDay) return

      const startDate = new Date(event.startAt)
      if (Number.isNaN(startDate.getTime())) return

      const endDate = new Date(event.endAt)
      if (Number.isNaN(endDate.getTime())) return

      const baseTime = startOfDay(activeBase).getTime()
      const startDayTime = startOfDay(startDate).getTime()
      const dayIndex = Math.round((startDayTime - baseTime) / DAY_MS)
      if (dayIndex < 0 || dayIndex >= dayCount) return

      const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
      const endMinutesRaw = endDate.getHours() * 60 + endDate.getMinutes()
      const endMinutes = clamp(endMinutesRaw, 0, MINUTES_PER_DAY)

      const startSlot = clamp(Math.floor(startMinutes / slotMinutes), 0, slotCount - 1)
      const endSlot = clamp(Math.ceil(endMinutes / slotMinutes), startSlot + 1, slotCount)

      // CalendarEventLayout expects the gen/api CalendarEvent type,
      // but our inline type is compatible enough for display purposes
      const entry: CalendarEventLayout = {
        event: event as never,
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

    // Assign lanes for overlapping events
    const finalized = new Map<number, CalendarEventLayout[]>()
    scheduledMap.forEach((list, dayIndex) => {
      const lanesEnd: number[] = []
      const sorted = [...list].sort((a, b) => {
        if (a.startSlot === b.startSlot) return a.endSlot - b.endSlot
        return a.startSlot - b.startSlot
      })
      sorted.forEach((item) => {
        let laneIndex = lanesEnd.findIndex((endSlot) => item.startSlot >= endSlot)
        if (laneIndex === -1) {
          laneIndex = lanesEnd.length
          lanesEnd.push(item.endSlot)
        } else {
          lanesEnd[laneIndex] = item.endSlot
        }
        item.lane = laneIndex
      })
      const laneCount = Math.max(lanesEnd.length, 1)
      finalized.set(
        dayIndex,
        sorted.map((item) => ({ ...item, laneCount }))
      )
    })

    return finalized
  }, [calendarEvents, activeBase, dayCount, slotMinutes, slotCount])

  // ==========================================================================
  // Effect: Drag-to-Create (New Time Range)
  // ==========================================================================
  React.useEffect(() => {
    if (!dragSelection) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      if (!activeColumnRef.current) return
      const endSlot = getSlotIndexFromEvent(event, activeColumnRef.current, slotHeight, slotCount)
      setDragSelection((prev) => (prev ? { ...prev, endSlot } : prev))
    }

    const handleMouseUp = (): void => {
      if (!dragSelection) return
      const { dayIndex, startSlot, endSlot } = dragSelection
      const [minSlot, maxSlot] = startSlot <= endSlot ? [startSlot, endSlot] : [endSlot, startSlot]
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
      const startDate = dateForSlot(baseDate, minSlot, slotMinutes)
      const endDate = dateForSlot(baseDate, maxSlot + 1, slotMinutes)
      onCreateRange?.({
        starts_at: isoToUnix(startDate.toISOString()),
        ends_at: isoToUnix(endDate.toISOString())
      })
      setDragSelection(null)
      activeColumnRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragSelection, activeBase, viewMode, onCreateRange, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Drag-to-Move (Existing Todo)
  // ==========================================================================
  React.useEffect(() => {
    if (!dragTask) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      const column = hit?.closest('[data-day-index]') as HTMLDivElement | null
      if (!column) return
      activeColumnRef.current = column
      setDidDragTask(true)
      const dayIndex = Number(column.dataset.dayIndex ?? 0)
      const rawSlot = getSlotIndexFromEvent(event, column, slotHeight, slotCount)
      const clampedStart = clamp(
        rawSlot - dragTask.offsetSlots,
        0,
        slotCount - dragTask.durationSlots
      )
      setDragTask((prev) =>
        prev
          ? {
              ...prev,
              dayIndex,
              startSlot: clampedStart
            }
          : prev
      )
    }

    const handleMouseUp = (): void => {
      if (!dragTask) return
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dragTask.dayIndex)
      const startDate = dateForSlot(baseDate, dragTask.startSlot, slotMinutes)
      const endDate = dateForSlot(
        baseDate,
        dragTask.startSlot + dragTask.durationSlots,
        slotMinutes
      )
      onTodoMove?.(dragTask.todo, {
        starts_at: isoToUnix(startDate.toISOString()),
        ends_at: isoToUnix(endDate.toISOString())
      })
      setDragTask(null)
      activeColumnRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragTask, activeBase, viewMode, onTodoMove, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Drag-to-Resize (Todo Top/Bottom Edge)
  // ==========================================================================
  React.useEffect(() => {
    if (!dragResize) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      const column = hit?.closest('[data-day-index]') as HTMLDivElement | null
      if (!column) return

      const pointerSlot = getSlotIndexFromEvent(event, column, slotHeight, slotCount)

      setDragResize((prev) => {
        if (!prev) return prev
        if (prev.edge === 'top') {
          const newStartSlot = clamp(pointerSlot, 0, prev.endSlot - 1)
          return { ...prev, startSlot: newStartSlot }
        } else {
          const newEndSlot = clamp(pointerSlot + 1, prev.startSlot + 1, slotCount)
          return { ...prev, endSlot: newEndSlot }
        }
      })
    }

    const handleMouseUp = (): void => {
      if (!dragResize) return
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dragResize.dayIndex)
      const startDate = dateForSlot(baseDate, dragResize.startSlot, slotMinutes)
      const endDate = dateForSlot(baseDate, dragResize.endSlot, slotMinutes)
      onTodoMove?.(dragResize.todo, {
        starts_at: isoToUnix(startDate.toISOString()),
        ends_at: isoToUnix(endDate.toISOString())
      })
      setDragResize(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragResize, activeBase, viewMode, onTodoMove, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Auto-Scroll to Current Time
  // ==========================================================================
  React.useEffect(() => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const containerHeight = container.clientHeight
    const totalContentHeight = slotCount * slotHeight

    const currentTime = new Date()
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    const currentTimeTop = (currentMinutes / slotMinutes) * slotHeight

    let targetScrollTop = currentTimeTop - containerHeight / 2
    const maxScrollTop = Math.max(0, totalContentHeight - containerHeight)
    targetScrollTop = clamp(targetScrollTop, 0, maxScrollTop)

    container.scrollTop = targetScrollTop
  }, [viewMode, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Update Current Time Every Minute
  // ==========================================================================
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  const handleColumnMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    dayIndex: number
  ): void => {
    if ((event.target as HTMLElement).closest('[data-task-block="true"]')) {
      return
    }
    event.preventDefault()
    const column = event.currentTarget
    activeColumnRef.current = column
    const startSlot = getSlotIndexFromEvent(event.nativeEvent, column, slotHeight, slotCount)
    setDragSelection({ dayIndex, startSlot, endSlot: startSlot })
  }

  const handleTaskMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>,
    item: TodoLayout
  ): void => {
    if ((event.target as HTMLElement).closest('[data-task-action="true"]')) {
      return
    }
    event.preventDefault()
    setDidDragTask(false)
    const column = event.currentTarget.closest('[data-day-index]') as HTMLDivElement | null
    if (!column) return
    activeColumnRef.current = column
    const slotAtPointer = getSlotIndexFromEvent(event.nativeEvent, column, slotHeight, slotCount)
    const durationSlots = Math.max(1, item.endSlot - item.startSlot)
    setDragTask({
      todo: item.todo,
      dayIndex: item.dayIndex,
      durationSlots,
      offsetSlots: clamp(slotAtPointer - item.startSlot, 0, durationSlots - 1),
      startSlot: item.startSlot
    })
  }

  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    item: TodoLayout,
    edge: 'top' | 'bottom'
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    setDidDragTask(true)
    setDragResize({
      todo: item.todo,
      dayIndex: item.dayIndex,
      startSlot: item.startSlot,
      endSlot: item.endSlot,
      edge
    })
  }

  // ==========================================================================
  // Render Helpers
  // ==========================================================================
  const dayLabels =
    viewMode === 'day'
      ? [formatDayLabel(dayStart)]
      : Array.from({ length: 7 }, (_, index) => formatDayLabel(addDays(weekStart, index)))

  const totalHeight = slotCount * slotHeight

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div className={cn('flex flex-1 min-h-0 flex-col gap-4 p-6', className)}>
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAnchorDate((prev) => addDays(prev, viewMode === 'day' ? -1 : -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAnchorDate(startOfDay(new Date()))}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAnchorDate((prev) => addDays(prev, viewMode === 'day' ? 1 : 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {viewMode === 'day' ? formatDayLabel(dayStart) : formatWeekLabel(weekStart)}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerTrailing}
            <div className="flex items-center gap-1 mr-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                title="Zoom out (Cmd/Ctrl + Scroll)"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                title="Zoom in (Cmd/Ctrl + Scroll)"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant={viewMode === 'day' ? 'default' : 'outline'}
              onClick={() => handleViewModeChange('day')}
            >
              Day
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'week' ? 'default' : 'outline'}
              onClick={() => handleViewModeChange('week')}
            >
              Week
            </Button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col rounded-md border bg-muted/5">
        <div className="flex border-b bg-muted/10 text-xs">
          <div className="w-12 flex-shrink-0 px-2 py-2 text-muted-foreground">Time</div>
          <div className={cn('grid flex-1', viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7')}>
            {dayLabels.map((label) => (
              <div key={label} className="px-2 py-2 text-muted-foreground">
                {label}
              </div>
            ))}
          </div>
        </div>
        <div ref={scrollContainerRef} className="flex min-h-0 flex-1 overflow-y-auto">
          <div className="w-12 flex-shrink-0">
            <div className="relative" style={{ height: totalHeight }}>
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="absolute left-2 text-[10px] text-muted-foreground"
                  style={{ top: hour * slotsPerHour * slotHeight - HOUR_LABEL_VERTICAL_OFFSET }}
                >
                  {formatHourLabel(hour)}
                </div>
              ))}
            </div>
          </div>
          <div
            className={cn(
              'relative grid flex-1',
              viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'
            )}
            style={{ height: totalHeight }}
          >
            {Array.from({ length: dayCount }, (_, dayIndex) => {
              const dayTodos = scheduledByDay.get(dayIndex) ?? []
              const dayEvents = eventsByDay.get(dayIndex) ?? []
              const selection =
                dragSelection && dragSelection.dayIndex === dayIndex ? dragSelection : null
              const selectionTop = selection ? selection.startSlot * slotHeight : 0
              const selectionHeight = selection
                ? (selection.endSlot - selection.startSlot + 1) * slotHeight
                : 0
              const dayDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
              const isToday = startOfDay(dayDate).getTime() === startOfDay(now).getTime()
              const nowMinutes = now.getHours() * 60 + now.getMinutes()
              const nowTop = clamp(
                (nowMinutes * slotHeight) / slotMinutes,
                0,
                slotCount * slotHeight
              )

              return (
                <div
                  key={`day-${dayIndex}`}
                  className="relative border-l first:border-l-0"
                  data-day-index={dayIndex}
                  onMouseDown={(event) => handleColumnMouseDown(event, dayIndex)}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={`hour-${dayIndex}-${hour}`}
                      className="absolute left-0 right-0 border-t border-muted-foreground/20"
                      style={{ top: hour * slotsPerHour * slotHeight }}
                    />
                  ))}
                  {selection && (
                    <div
                      className="absolute left-1 right-1 rounded-md bg-primary/10 outline outline-1 outline-primary/30"
                      style={{ top: selectionTop, height: selectionHeight }}
                    />
                  )}
                  {isToday && (
                    <div
                      className="absolute left-0 right-0 h-px bg-primary/70"
                      style={{ top: nowTop }}
                    >
                      <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
                      <div className="absolute -left-14 top-1/2 -translate-y-1/2 text-[10px] font-medium text-primary">
                        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}
                  {dragTask && dragTask.dayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-md bg-primary/20 outline outline-1 outline-primary/40"
                      style={{
                        top: dragTask.startSlot * slotHeight,
                        height: dragTask.durationSlots * slotHeight
                      }}
                    />
                  )}
                  {dragResize && dragResize.dayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-md bg-primary/20 outline outline-1 outline-primary/40"
                      style={{
                        top: dragResize.startSlot * slotHeight,
                        height: (dragResize.endSlot - dragResize.startSlot) * slotHeight
                      }}
                    />
                  )}
                  {dayTodos.map((item) => {
                    const isResizing = dragResize?.todo.id === item.todo.id
                    const resizeItem = isResizing ? dragResize : null
                    const displayStartSlot = resizeItem ? resizeItem.startSlot : item.startSlot
                    const displayEndSlot = resizeItem ? resizeItem.endSlot : item.endSlot

                    const top = displayStartSlot * slotHeight
                    const height = Math.max(1, (displayEndSlot - displayStartSlot) * slotHeight)
                    const width = 100 / item.laneCount
                    const left = item.lane * width
                    const isDragging = dragTask?.todo.id === item.todo.id
                    const isCompleted = item.todo.done === 1

                    return (
                      <button
                        key={item.todo.id}
                        type="button"
                        onClick={() => {
                          if (didDragTask) {
                            setDidDragTask(false)
                            return
                          }
                          onTodoSelect?.(item.todo)
                        }}
                        onMouseDown={(event) => handleTaskMouseDown(event, item)}
                        data-task-block="true"
                        className={cn(
                          'absolute rounded-md bg-primary/15 px-2 py-1 text-left text-xs outline outline-1 outline-primary/30 hover:bg-primary/20',
                          (isDragging || isResizing) && 'opacity-40',
                          isCompleted &&
                            'bg-muted/60 text-slate-500 outline-muted-foreground/30 hover:bg-muted/70'
                        )}
                        style={{
                          top,
                          height,
                          left: `${left}%`,
                          width: `${width}%`
                        }}
                      >
                        {/* Top resize handle */}
                        <div
                          data-task-action="true"
                          className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize hover:bg-primary/30 rounded-t-md"
                          onMouseDown={(event) => handleResizeMouseDown(event, item, 'top')}
                        />
                        {/* Bottom resize handle */}
                        <div
                          data-task-action="true"
                          className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize hover:bg-primary/30 rounded-b-md"
                          onMouseDown={(event) => handleResizeMouseDown(event, item, 'bottom')}
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground/90 line-clamp-1">
                              {item.todo.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatTimeRange(item.startDate, item.endDate)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {onTodoEdit && (
                              <button
                                type="button"
                                data-task-block="true"
                                data-task-action="true"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onTodoEdit(item.todo)
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                aria-label="Edit todo"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {onTodoDelete && (
                              <button
                                type="button"
                                data-task-block="true"
                                data-task-action="true"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onTodoDelete(item.todo)
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                aria-label="Delete todo"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {/* Calendar events - grayish to distinguish from todos */}
                  {dayEvents.map((eventItem) => {
                    const top = eventItem.startSlot * slotHeight
                    const height = Math.max(
                      1,
                      (eventItem.endSlot - eventItem.startSlot) * slotHeight
                    )
                    const width = 100 / eventItem.laneCount
                    const left = eventItem.lane * width
                    const evt = eventItem.event as unknown as CalendarEvent

                    return (
                      <div
                        key={evt.id}
                        className="absolute rounded-md px-2 py-1 text-left text-xs bg-slate-200/60 dark:bg-slate-700/50 border-l-[3px] border-slate-400 dark:border-slate-500 pointer-events-none"
                        style={{
                          top,
                          height,
                          left: `${left}%`,
                          width: `${width}%`
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-medium line-clamp-1 text-slate-600 dark:text-slate-300">
                            {evt.title}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {formatTimeRange(eventItem.startDate, eventItem.endDate)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CalendarView — self-contained wrapper with data fetching + create dialog
// ============================================================================

export function CalendarView(): React.JSX.Element {
  const { todos, createTodo, updateTodo, deleteTodo } = useTodos({ showAll: true })
  const [visibleDate, setVisibleDate] = useState<Date>(() => startOfDay(new Date()))

  // Create dialog state
  const [createDraft, setCreateDraft] = useState<{
    title: string
    startTime: string
    endTime: string
  } | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Handle drag-to-create on the calendar grid
  const handleCreateRange = useCallback((range: { starts_at: number; ends_at: number }) => {
    const start = new Date(range.starts_at * 1000)
    const end = new Date(range.ends_at * 1000)
    const fmt = (d: Date): string =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setCreateDraft({ title: '', startTime: fmt(start), endTime: fmt(end) })
  }, [])

  // Handle the "+ New" button (defaults to current hour, 1h duration)
  const handleNewButton = useCallback(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 60 * 60 * 1000)
    const fmt = (d: Date): string =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setCreateDraft({ title: '', startTime: fmt(now), endTime: fmt(end) })
  }, [])

  // Submit the create dialog
  const handleCreateSubmit = useCallback(async () => {
    if (!createDraft || !createDraft.title.trim()) return
    setIsCreating(true)
    try {
      const [sh, sm] = createDraft.startTime.split(':').map(Number)
      const [eh, em] = createDraft.endTime.split(':').map(Number)
      const startDate = new Date(
        visibleDate.getFullYear(),
        visibleDate.getMonth(),
        visibleDate.getDate(),
        sh,
        sm
      )
      const endDate = new Date(
        visibleDate.getFullYear(),
        visibleDate.getMonth(),
        visibleDate.getDate(),
        eh,
        em
      )
      await createTodo(
        createDraft.title.trim(),
        Math.floor(startDate.getTime() / 1000),
        Math.floor(endDate.getTime() / 1000)
      )
      setCreateDraft(null)
    } finally {
      setIsCreating(false)
    }
  }, [createDraft, createTodo, visibleDate])

  // Handle drag-to-move
  const handleTodoMove = useCallback(
    async (todo: Todo, range: { starts_at: number; ends_at: number }) => {
      await updateTodo(todo.id, { starts_at: range.starts_at, ends_at: range.ends_at })
    },
    [updateTodo]
  )

  // Handle delete
  const handleTodoDelete = useCallback(
    async (todo: Todo) => {
      await deleteTodo(todo.id)
    },
    [deleteTodo]
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <CalendarViewInner
        todos={todos}
        onCreateRange={handleCreateRange}
        onAnchorDateChange={setVisibleDate}
        onTodoMove={handleTodoMove}
        onTodoDelete={handleTodoDelete}
        headerTrailing={
          <Button
            size="sm"
            className="shrink-0 gap-1 rounded-full"
            style={{ background: 'var(--amber)' }}
            onClick={handleNewButton}
          >
            <Plus className="w-4 h-4" />
            New
          </Button>
        }
      />

      {/* Create todo dialog */}
      <Dialog
        open={Boolean(createDraft)}
        onOpenChange={(open) => {
          if (!open && !isCreating) setCreateDraft(null)
        }}
      >
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <h3 className="font-title text-lg">New ToDo</h3>
            <Input
              value={createDraft?.title ?? ''}
              onChange={(e) => setCreateDraft((d) => (d ? { ...d, title: e.target.value } : d))}
              placeholder="タスク名を入力..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCreateSubmit()
                }
              }}
            />
            <div className="flex items-center gap-3 text-sm">
              <label className="text-muted-foreground w-12">From</label>
              <Input
                type="time"
                value={createDraft?.startTime ?? ''}
                onChange={(e) =>
                  setCreateDraft((d) => (d ? { ...d, startTime: e.target.value } : d))
                }
                className="w-32 h-8"
              />
              <label className="text-muted-foreground w-8">To</label>
              <Input
                type="time"
                value={createDraft?.endTime ?? ''}
                onChange={(e) => setCreateDraft((d) => (d ? { ...d, endTime: e.target.value } : d))}
                className="w-32 h-8"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateDraft(null)} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={isCreating || !createDraft?.title.trim()}
                style={{ background: 'var(--amber)' }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
