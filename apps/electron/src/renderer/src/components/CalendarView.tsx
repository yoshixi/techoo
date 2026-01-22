/**
 * CalendarView.tsx
 *
 * A day/week calendar timeline component for visualizing and managing scheduled tasks.
 *
 * Features:
 * - Day and week view modes with navigation
 * - Drag-to-create new time ranges on empty space
 * - Drag-to-move existing tasks to different times/days
 * - Drag-to-resize tasks from top or bottom edges
 * - Zoom in/out with buttons or Cmd/Ctrl + scroll wheel
 * - Dynamic slot granularity that adjusts based on zoom level
 * - Current time indicator with auto-scroll on mount
 * - Lane-based layout for overlapping tasks
 */
import React, { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Minus, Pencil, Play, Plus, Square, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import type { Task, TaskTimer } from '../gen/api'
import {
  MINUTES_PER_DAY,
  DAY_MS,
  VISIBLE_START_HOUR,
  VISIBLE_END_HOUR_CALENDAR as VISIBLE_END_HOUR,
  MIN_SLOT_HEIGHT_PX,
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
  computeTaskEnd,
  getSlotIndexFromEvent,
  dateForSlot,
  assignLanes,
  type TaskLayout
} from '../lib/calendar-utils'

// ============================================================================
// Types
// ============================================================================

/** Calendar view mode: single day or full week */
export type ViewMode = 'day' | 'week'

/** Props for the CalendarView component */
type CalendarViewProps = {
  /** Array of tasks to display on the calendar */
  tasks: Task[]
  /** Controlled view mode (day or week) */
  viewMode?: ViewMode
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void
  /** Callback when a task is clicked (for viewing details) */
  onTaskSelect?: (task: Task) => void
  /** Callback when edit button is clicked on a task */
  onTaskEdit?: (task: Task) => void
  /** Callback when delete button is clicked on a task */
  onTaskDelete?: (task: Task) => void
  /** Callback when a task is dragged to a new time/day */
  onTaskMove?: (task: Task, range: { startAt: string; endAt: string }) => void
  /** Map of task IDs to their active timers (for showing timer state) */
  activeTimersByTaskId?: Map<string, TaskTimer>
  /** Callback to start a timer for a task */
  onTaskStartTimer?: (taskId: string) => void
  /** Callback to stop a timer for a task */
  onTaskStopTimer?: (taskId: string, timerId: string) => void
  /** Callback when user drags to create a new time range */
  onCreateRange?: (range: { startAt: string; endAt: string }) => void
  /** Additional CSS classes */
  className?: string
}

/**
 * CalendarView
 * - Day/week timeline that lays out all scheduled tasks.
 * - Drag empty space to create a new time range (onCreateRange).
 * - Drag an existing task to move its time range (onTaskMove).
 *
 * Example:
 * <CalendarView
 *   tasks={tasks}
 *   onTaskSelect={setSelectedTask}
 *   onCreateRange={({ startAt, endAt }) => openDraft(startAt, endAt)}
 *   onTaskMove={(task, range) => updateTask(task.id, range)}
 * />
 */
export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  viewMode: viewModeProp,
  onViewModeChange,
  onTaskSelect,
  onTaskEdit,
  onTaskDelete,
  onTaskMove,
  activeTimersByTaskId,
  onTaskStartTimer,
  onTaskStopTimer,
  onCreateRange,
  className
}) => {
  // ==========================================================================
  // State: View Mode (controlled or uncontrolled)
  // ==========================================================================
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('day')
  const viewMode = viewModeProp ?? internalViewMode
  const handleViewModeChange = React.useCallback(
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
  /** The reference date for the current view (start of day for day view, used for week calculation) */
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()))
  /** Current time, updated every minute for the "now" indicator */
  const [now, setNow] = useState<Date>(() => new Date())

  // ==========================================================================
  // State: Zoom & Slot Configuration
  // ==========================================================================
  /** Current zoom level (0.5 to 3.0) */
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM)
  /** Base slot height before zoom is applied (calculated from container height) */
  const [baseSlotHeight, setBaseSlotHeight] = useState<number>(15)
  /** Actual slot height in pixels (baseSlotHeight * zoomLevel) */
  const slotHeight = Math.max(MIN_SLOT_HEIGHT_PX, Math.round(baseSlotHeight * zoomLevel))

  /** Slot configuration derived from zoom level (slotMinutes, slotsPerHour, slotCount) */
  const slotConfig = useMemo(() => getSlotConfig(zoomLevel), [zoomLevel])
  const { slotMinutes, slotsPerHour, slotCount } = slotConfig

  // ==========================================================================
  // State: Drag Operations
  // ==========================================================================
  /** Active drag-to-create selection (creating new task time range) */
  const [dragSelection, setDragSelection] = useState<{
    dayIndex: number
    startSlot: number
    endSlot: number
  } | null>(null)

  /** Active drag-to-move operation (moving existing task) */
  const [dragTask, setDragTask] = useState<{
    task: Task
    dayIndex: number
    durationSlots: number
    /** Offset from pointer to task start, for smooth dragging */
    offsetSlots: number
    startSlot: number
  } | null>(null)

  /** Active drag-to-resize operation */
  const [dragResize, setDragResize] = useState<{
    task: Task
    dayIndex: number
    startSlot: number
    endSlot: number
    edge: 'top' | 'bottom'
  } | null>(null)

  /** Flag to distinguish click from drag-end on tasks */
  const [didDragTask, setDidDragTask] = useState(false)

  // ==========================================================================
  // Refs
  // ==========================================================================
  /** Reference to the current day column being interacted with */
  const activeColumnRef = React.useRef<HTMLDivElement | null>(null)
  /** Reference to the scrollable container for auto-scroll and wheel zoom */
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
      // Only zoom when Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()

      // Determine zoom direction based on scroll
      if (event.deltaY < 0) {
        // Scroll up = zoom in
        setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
      } else if (event.deltaY > 0) {
        // Scroll down = zoom out
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
  /** Base date for the current view (day start or week start) */
  const activeBase = viewMode === 'day' ? dayStart : weekStart
  /** Number of day columns to render (1 for day view, 7 for week view) */
  const dayCount = viewMode === 'day' ? 1 : 7

  // ==========================================================================
  // Memoized: Task Layout Calculation
  // ==========================================================================
  /**
   * Processes tasks into layout items grouped by day.
   * Calculates slot positions, handles overlaps via lane assignment.
   */
  const { scheduledByDay } = useMemo(() => {
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

    return { scheduledByDay: finalized }
  }, [tasks, activeBase, dayCount, slotMinutes, slotCount])

  // ==========================================================================
  // Effect: Drag-to-Create (New Task Time Range)
  // ==========================================================================
  React.useEffect(() => {
    if (!dragSelection) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      if (!activeColumnRef.current) return
      const endSlot = getSlotIndexFromEvent(event, activeColumnRef.current, slotHeight, slotCount)
      setDragSelection((prev) =>
        prev ? { ...prev, endSlot } : prev
      )
    }

    const handleMouseUp = (): void => {
      if (!dragSelection) return
      const { dayIndex, startSlot, endSlot } = dragSelection
      const [minSlot, maxSlot] = startSlot <= endSlot ? [startSlot, endSlot] : [endSlot, startSlot]
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
      const startDate = dateForSlot(baseDate, minSlot, slotMinutes)
      const endDate = dateForSlot(baseDate, maxSlot + 1, slotMinutes)
      onCreateRange?.({ startAt: startDate.toISOString(), endAt: endDate.toISOString() })
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
  // Effect: Drag-to-Move (Existing Task)
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
      const endDate = dateForSlot(baseDate, dragTask.startSlot + dragTask.durationSlots, slotMinutes)
      onTaskMove?.(dragTask.task, {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString()
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
  }, [dragTask, activeBase, viewMode, onTaskMove, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Drag-to-Resize (Task Top/Bottom Edge)
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
          // Dragging top edge - adjust startSlot, keep endSlot fixed
          // endSlot is exclusive, so max startSlot is endSlot - 1
          const newStartSlot = clamp(pointerSlot, 0, prev.endSlot - 1)
          return { ...prev, startSlot: newStartSlot }
        } else {
          // Dragging bottom edge - adjust endSlot, keep startSlot fixed
          // endSlot is exclusive, so pointerSlot + 1 makes the task cover that slot
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
      onTaskMove?.(dragResize.task, {
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString()
      })
      setDragResize(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragResize, activeBase, viewMode, onTaskMove, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Auto-Scroll to Current Time
  // Centers the current time in the viewport on mount and when view changes.
  // Does not re-scroll on every minute update to avoid disrupting user scroll.
  // ==========================================================================
  React.useEffect(() => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const containerHeight = container.clientHeight
    const totalContentHeight = slotCount * slotHeight

    // Calculate current time position (use fresh Date for accurate time)
    const currentTime = new Date()
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
    const currentTimeTop = (currentMinutes / slotMinutes) * slotHeight

    // Try to center current time in viewport
    let targetScrollTop = currentTimeTop - containerHeight / 2

    // Clamp to valid scroll range (no whitespace at bottom)
    const maxScrollTop = Math.max(0, totalContentHeight - containerHeight)
    targetScrollTop = clamp(targetScrollTop, 0, maxScrollTop)

    container.scrollTop = targetScrollTop
  }, [viewMode, slotHeight, slotCount, slotMinutes])

  // ==========================================================================
  // Effect: Calculate Base Slot Height from Container Size
  // Ensures the visible time window (VISIBLE_START_HOUR to VISIBLE_END_HOUR)
  // fills the container at 100% zoom. Responds to container resizes.
  // ==========================================================================
  React.useEffect(() => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const defaultConfig = getSlotConfig(DEFAULT_ZOOM)
    const visibleSlots = (VISIBLE_END_HOUR - VISIBLE_START_HOUR) * defaultConfig.slotsPerHour

    const updateBaseSlotHeight = () => {
      const nextHeight = Math.max(
        MIN_SLOT_HEIGHT_PX,
        Math.floor(container.clientHeight / visibleSlots)
      )
      setBaseSlotHeight(nextHeight)
    }

    updateBaseSlotHeight()

    const observer = new ResizeObserver(updateBaseSlotHeight)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

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

  /**
   * Handles mousedown on empty space in a day column.
   * Initiates drag-to-create mode for new task time ranges.
   */
  const handleColumnMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    dayIndex: number
  ): void => {
    // Ignore if clicking on a task block
    if ((event.target as HTMLElement).closest('[data-task-block="true"]')) {
      return
    }
    event.preventDefault()
    const column = event.currentTarget
    activeColumnRef.current = column
    const startSlot = getSlotIndexFromEvent(event.nativeEvent, column, slotHeight, slotCount)
    setDragSelection({ dayIndex, startSlot, endSlot: startSlot })
  }

  /**
   * Handles mousedown on a task block.
   * Initiates drag-to-move mode (unless clicking an action button).
   */
  const handleTaskMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>,
    item: TaskLayout
  ): void => {
    // Ignore if clicking on action buttons (play, edit, delete)
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
      task: item.task,
      dayIndex: item.dayIndex,
      durationSlots,
      // Calculate offset so task doesn't jump to pointer position
      offsetSlots: clamp(slotAtPointer - item.startSlot, 0, durationSlots - 1),
      startSlot: item.startSlot
    })
  }

  /**
   * Handles mousedown on task resize handles (top or bottom edge).
   * Initiates drag-to-resize mode.
   */
  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    item: TaskLayout,
    edge: 'top' | 'bottom'
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    setDidDragTask(true) // Prevent click handler from firing
    setDragResize({
      task: item.task,
      dayIndex: item.dayIndex,
      startSlot: item.startSlot,
      endSlot: item.endSlot,
      edge
    })
  }

  // ==========================================================================
  // Render Helpers
  // ==========================================================================
  /** Column header labels for each day */
  const dayLabels = viewMode === 'day'
    ? [formatDayLabel(dayStart)]
    : Array.from({ length: 7 }, (_, index) => formatDayLabel(addDays(weekStart, index)))

  /** Total height of the time grid in pixels */
  const totalHeight = slotCount * slotHeight

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setAnchorDate((prev) =>
                addDays(prev, viewMode === 'day' ? -1 : -7)
              )
            }
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
            onClick={() =>
              setAnchorDate((prev) =>
                addDays(prev, viewMode === 'day' ? 1 : 7)
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {viewMode === 'day'
            ? formatDayLabel(dayStart)
            : formatWeekLabel(weekStart)}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
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
        {/* The scroll area is flex-1 and min-h-0 so it can shrink/grow with the window. */}
        <div ref={scrollContainerRef} className="flex min-h-0 flex-1 overflow-y-auto">
          <div className="w-12 flex-shrink-0">
            <div className="relative" style={{ height: totalHeight }}>
              {/* Hour labels (00:00, 01:00, etc.)
                  Note: HOUR_LABEL_VERTICAL_OFFSET centers the label with the hour line.
                  If you change text-[10px], update HOUR_LABEL_VERTICAL_OFFSET accordingly
                  (should be ~half the line height). */}
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
            className={cn('relative grid flex-1', viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7')}
            style={{ height: totalHeight }}
          >
            {Array.from({ length: dayCount }, (_, dayIndex) => {
              const dayTasks = scheduledByDay.get(dayIndex) ?? []
              const selection =
                dragSelection && dragSelection.dayIndex === dayIndex ? dragSelection : null
              const selectionTop = selection ? selection.startSlot * slotHeight : 0
              const selectionHeight = selection
                ? (selection.endSlot - selection.startSlot + 1) * slotHeight
                : 0
              const dayDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
              const isToday =
                startOfDay(dayDate).getTime() === startOfDay(now).getTime()
              const nowMinutes = now.getHours() * 60 + now.getMinutes()
              const nowTop = clamp(
                Math.round(nowMinutes / slotMinutes) * slotHeight,
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
                      className="absolute left-0 right-0 h-px bg-red-500/70"
                      style={{ top: nowTop }}
                    >
                      <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500" />
                      <div className="absolute -left-14 top-1/2 -translate-y-1/2 text-[10px] font-medium text-red-500">
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
                  {dayTasks.map((item) => {
                    // Check if this task is being resized
                    const isResizing = dragResize?.task.id === item.task.id
                    const resizeItem = isResizing ? dragResize : null
                    const displayStartSlot = resizeItem ? resizeItem.startSlot : item.startSlot
                    const displayEndSlot = resizeItem ? resizeItem.endSlot : item.endSlot

                    const top = displayStartSlot * slotHeight
                    const height = Math.max(1, (displayEndSlot - displayStartSlot) * slotHeight)
                    const width = 100 / item.laneCount
                    const left = item.lane * width
                    const isDragging = dragTask?.task.id === item.task.id
                    const activeTimer = activeTimersByTaskId?.get(item.task.id)
                    const isCompleted = Boolean(item.task.completedAt)

                    return (
                      <button
                        key={item.task.id}
                        type="button"
                        onClick={() => {
                          if (didDragTask) {
                            setDidDragTask(false)
                            return
                          }
                          onTaskSelect?.(item.task)
                        }}
                        onMouseDown={(event) => handleTaskMouseDown(event, item)}
                        data-task-block="true"
                        className={cn(
                          'absolute rounded-md bg-primary/15 px-2 py-1 text-left text-xs outline outline-1 outline-primary/30 hover:bg-primary/20',
                          (isDragging || isResizing) && 'opacity-40',
                          isCompleted && 'bg-muted/60 text-slate-500 outline-muted-foreground/30 hover:bg-muted/70',
                          activeTimer && 'bg-red-500/15 text-red-700 outline-red-500/40 hover:bg-red-500/20'
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
                              {item.task.title}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatTimeRange(item.startDate, item.endDate)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {(onTaskStartTimer || onTaskStopTimer) && (
                              <button
                                type="button"
                                data-task-block="true"
                                data-task-action="true"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (activeTimer && onTaskStopTimer) {
                                    onTaskStopTimer(item.task.id, activeTimer.id)
                                    return
                                  }
                                  if (!activeTimer && onTaskStartTimer) {
                                    onTaskStartTimer(item.task.id)
                                  }
                                }}
                                className={cn(
                                  'rounded p-0.5',
                                  activeTimer
                                    ? 'text-red-600 hover:text-red-700'
                                    : 'text-green-600 hover:text-green-700'
                                )}
                                aria-label={activeTimer ? 'Stop timer' : 'Start timer'}
                              >
                                {activeTimer ? (
                                  <Square className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                              </button>
                            )}
                            {onTaskEdit && (
                              <button
                                type="button"
                                data-task-block="true"
                                data-task-action="true"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onTaskEdit(item.task)
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                aria-label="Edit task"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {onTaskDelete && (
                              <button
                                type="button"
                                data-task-block="true"
                                data-task-action="true"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onTaskDelete(item.task)
                                }}
                                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </button>
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
