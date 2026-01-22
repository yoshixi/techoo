import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import type { Task } from '../gen/api'
import {
  DAY_MS,
  VISIBLE_START_HOUR,
  VISIBLE_END_HOUR_PICKER as VISIBLE_END_HOUR,
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
  dateForSlot,
  calculateTaskLayouts,
  type TaskLayout
} from '../lib/calendar-utils'

type ViewMode = 'day' | 'week'

type DragSelection = {
  dayIndex: number
  startSlot: number
  endSlot: number
}

type DragMove = {
  dayIndex: number
  startSlot: number
  duration: number // in slots
  offsetSlot: number // offset from pointer to block start
}

type DragResize = {
  dayIndex: number
  startSlot: number
  endSlot: number
  edge: 'top' | 'bottom'
}

type TaskTimeRangePickerProps = {
  startAt?: string | null
  endAt?: string | null
  onChange: (next: { startAt: string | null; endAt: string | null }) => void
  /** All tasks to display on the calendar */
  tasks?: Task[]
  /** The ID of the current task being edited (for highlighting) */
  currentTaskId?: string
  className?: string
}

/** Base slot height before zoom (increased from 6 to 8 for better visibility) */
const BASE_SLOT_HEIGHT_PX = 8

const getSelectionFromRange = (
  startAt?: string | null,
  endAt?: string | null,
  dayStart?: Date,
  slotMinutes?: number,
  slotCount?: number
): DragSelection | null => {
  if (!startAt || !endAt || !dayStart || !slotMinutes || !slotCount) return null
  const startDate = new Date(startAt)
  const endDate = new Date(endAt)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  const base = startOfDay(dayStart).getTime()
  const startDayOffset = startOfDay(startDate).getTime() - base
  const endDayOffset = startOfDay(endDate).getTime() - base
  if (startDayOffset !== endDayOffset) return null
  const dayIndex = Math.round(startDayOffset / DAY_MS)
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
  const startSlot = clamp(Math.floor(startMinutes / slotMinutes), 0, slotCount - 1)
  const endSlot = clamp(Math.ceil(endMinutes / slotMinutes) - 1, 0, slotCount - 1)
  return { dayIndex, startSlot, endSlot }
}

/**
 * TaskTimeRangePicker
 * - Day/week timeline with configurable slot granularity based on zoom level.
 * - Drag to select a range; emits startAt/endAt on mouse up.
 * - Auto-scrolls to the current selection (or 06:00 by default).
 * - Displays other tasks with muted styling.
 */
export const TaskTimeRangePicker: React.FC<TaskTimeRangePickerProps> = ({
  startAt,
  endAt,
  onChange,
  tasks,
  currentTaskId,
  className
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()))
  const [dragMove, setDragMove] = useState<DragMove | null>(null)
  const [dragResize, setDragResize] = useState<DragResize | null>(null)
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const hasInitialScrolled = useRef(false)

  // Slot configuration based on zoom level
  const slotConfig = useMemo(() => getSlotConfig(zoomLevel), [zoomLevel])
  const { slotMinutes, slotsPerHour, slotCount } = slotConfig
  const slotHeight = Math.max(MIN_SLOT_HEIGHT_PX, Math.round(BASE_SLOT_HEIGHT_PX * zoomLevel))

  const dayStart = useMemo(() => startOfDay(anchorDate), [anchorDate])
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const activeBase = viewMode === 'day' ? dayStart : weekStart
  const dayCount = viewMode === 'day' ? 1 : 7

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  }, [])

  // Cmd/Ctrl + Scroll Wheel Zoom
  useEffect(() => {
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

  // Calculate task layouts for displaying other tasks
  const taskLayoutsByDay = useMemo(() => {
    if (!tasks || tasks.length === 0) return new Map<number, TaskLayout[]>()
    return calculateTaskLayouts(tasks, activeBase, dayCount, slotMinutes, slotCount)
  }, [tasks, activeBase, dayCount, slotMinutes, slotCount])

  useEffect(() => {
    if (startAt) {
      const startDate = new Date(startAt)
      if (!Number.isNaN(startDate.getTime())) {
        setAnchorDate(startOfDay(startDate))
      }
    }
  }, [startAt])

  // Effect for drag-to-move existing selection
  useEffect(() => {
    if (!dragMove) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      if (!gridRef.current) return

      // Find which column we're over
      const columns = Array.from(gridRef.current.querySelectorAll('[data-day-column]'))
      let targetDayIndex = dragMove.dayIndex
      let targetRect: DOMRect | null = null

      for (let index = 0; index < columns.length; index++) {
        const col = columns[index]
        const rect = col.getBoundingClientRect()
        if (event.clientX >= rect.left && event.clientX <= rect.right) {
          targetDayIndex = index
          targetRect = rect
          break
        }
      }

      if (targetRect) {
        const offset = event.clientY - targetRect.top
        const clamped = clamp(offset, 0, targetRect.height - 1)
        const pointerSlot = clamp(Math.floor(clamped / slotHeight), 0, slotCount - 1)
        const newStartSlot = clamp(pointerSlot - dragMove.offsetSlot, 0, slotCount - dragMove.duration)

        setDragMove((prev) =>
          prev ? { ...prev, dayIndex: targetDayIndex, startSlot: newStartSlot } : prev
        )
      }
    }

    const handleMouseUp = (): void => {
      if (!dragMove) return
      const { dayIndex, startSlot, duration } = dragMove
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
      const startDate = dateForSlot(baseDate, startSlot, slotMinutes)
      const endDate = dateForSlot(baseDate, startSlot + duration, slotMinutes)
      onChange({ startAt: startDate.toISOString(), endAt: endDate.toISOString() })
      setDragMove(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragMove, activeBase, viewMode, onChange, slotHeight, slotCount, slotMinutes])

  // Effect for drag-to-resize selection
  useEffect(() => {
    if (!dragResize) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      if (!gridRef.current) return

      const columns = Array.from(gridRef.current.querySelectorAll('[data-day-column]'))
      const col = columns[dragResize.dayIndex]
      if (!col) return

      const rect = col.getBoundingClientRect()
      const offset = event.clientY - rect.top
      const clamped = clamp(offset, 0, rect.height - 1)
      const pointerSlot = clamp(Math.floor(clamped / slotHeight), 0, slotCount - 1)

      setDragResize((prev) => {
        if (!prev) return prev
        if (prev.edge === 'top') {
          // Dragging top edge - adjust startSlot, keep endSlot fixed
          const newStartSlot = Math.min(pointerSlot, prev.endSlot)
          return { ...prev, startSlot: newStartSlot }
        } else {
          // Dragging bottom edge - adjust endSlot, keep startSlot fixed
          const newEndSlot = Math.max(pointerSlot, prev.startSlot)
          return { ...prev, endSlot: newEndSlot }
        }
      })
    }

    const handleMouseUp = (): void => {
      if (!dragResize) return
      const { dayIndex, startSlot, endSlot } = dragResize
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
      const startDate = dateForSlot(baseDate, startSlot, slotMinutes)
      const endDate = dateForSlot(baseDate, endSlot + 1, slotMinutes)
      onChange({ startAt: startDate.toISOString(), endAt: endDate.toISOString() })
      setDragResize(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragResize, activeBase, viewMode, onChange, slotHeight, slotCount, slotMinutes])

  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    selection: DragSelection,
    edge: 'top' | 'bottom'
  ): void => {
    event.preventDefault()
    event.stopPropagation()

    setDragResize({
      dayIndex: selection.dayIndex,
      startSlot: selection.startSlot,
      endSlot: selection.endSlot,
      edge
    })
  }

  const handleSelectionMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    selection: DragSelection
  ): void => {
    event.preventDefault()
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const offsetSlot = Math.floor(offsetY / slotHeight)
    const duration = selection.endSlot - selection.startSlot + 1

    setDragMove({
      dayIndex: selection.dayIndex,
      startSlot: selection.startSlot,
      duration,
      offsetSlot
    })
  }

  const handleColumnMouseDown = (
    _event: React.MouseEvent<HTMLDivElement>,
    _dayIndex: number
  ): void => {
    // Disabled: clicking on empty area should not create a new selection
    // Users should only modify the schedule by dragging the existing selection (move/resize)
  }

  const derivedSelection = useMemo(() => {
    const base = viewMode === 'day' ? dayStart : weekStart
    return getSelectionFromRange(startAt, endAt, base, slotMinutes, slotCount)
  }, [startAt, endAt, viewMode, dayStart, weekStart, slotMinutes, slotCount])

  // Convert dragMove to selection format for rendering
  const dragMoveAsSelection: DragSelection | null = dragMove
    ? {
        dayIndex: dragMove.dayIndex,
        startSlot: dragMove.startSlot,
        endSlot: dragMove.startSlot + dragMove.duration - 1
      }
    : null

  const selectionToRender = dragResize ?? dragMoveAsSelection ?? derivedSelection
  const isDragging = dragMove !== null || dragResize !== null

  const dayLabels = viewMode === 'day'
    ? [formatDayLabel(dayStart)]
    : Array.from({ length: 7 }, (_, index) => formatDayLabel(addDays(weekStart, index)))

  const totalHeight = slotCount * slotHeight

  // Calculate visible area height (extended to 8PM for better visibility)
  const visibleAreaHeight = (VISIBLE_END_HOUR - VISIBLE_START_HOUR) * slotsPerHour * slotHeight

  // Auto-scroll to selection on initial mount only (not when user changes the schedule)
  useEffect(() => {
    if (hasInitialScrolled.current) return
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current

    if (selectionToRender) {
      // Scroll to center the selection
      const targetTop = selectionToRender.startSlot * slotHeight
      const centeredTop = Math.max(0, targetTop - container.clientHeight / 2)
      container.scrollTop = centeredTop
    } else {
      // No selection, scroll to 6AM
      const targetTop = VISIBLE_START_HOUR * slotsPerHour * slotHeight
      container.scrollTop = targetTop
    }

    hasInitialScrolled.current = true
  }, [selectionToRender, slotHeight, slotsPerHour])

  // Reset scroll flag when view mode changes (user wants to see different view)
  useEffect(() => {
    hasInitialScrolled.current = false
  }, [viewMode])

  return (
    <div className={cn('space-y-2', className)}>
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
            onClick={() => setViewMode('day')}
          >
            Day
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'week' ? 'default' : 'outline'}
            onClick={() => setViewMode('week')}
          >
            Week
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-muted/5">
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
        <div
          ref={scrollContainerRef}
          className="flex overflow-y-auto"
          style={{ height: visibleAreaHeight }}
        >
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
            ref={gridRef}
            className={cn('relative grid flex-1', viewMode === 'day' ? 'grid-cols-1' : 'grid-cols-7')}
            style={{ height: totalHeight }}
          >
            {Array.from({ length: viewMode === 'day' ? 1 : 7 }, (_, dayIndex) => {
              const selection =
                selectionToRender && selectionToRender.dayIndex === dayIndex
                  ? selectionToRender
                  : null
              const selectionTop = selection ? selection.startSlot * slotHeight : 0
              const selectionHeight = selection
                ? (selection.endSlot - selection.startSlot + 1) * slotHeight
                : 0

              // Get tasks for this day
              const dayTasks = taskLayoutsByDay.get(dayIndex) ?? []

              return (
                <div
                  key={`day-${dayIndex}`}
                  data-day-column
                  className="relative border-l first:border-l-0"
                  onMouseDown={(event) => handleColumnMouseDown(event, dayIndex)}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={`hour-${dayIndex}-${hour}`}
                      className="absolute left-0 right-0 border-t border-muted-foreground/20"
                      style={{ top: hour * slotsPerHour * slotHeight }}
                    />
                  ))}

                  {/* Render other tasks with muted styling */}
                  {dayTasks.map((item) => {
                    const isCurrentTask = item.task.id === currentTaskId
                    // Skip the current task from displaying in the background
                    if (isCurrentTask) return null

                    const top = item.startSlot * slotHeight
                    const height = Math.max(1, (item.endSlot - item.startSlot) * slotHeight)
                    const width = 100 / item.laneCount
                    const left = item.lane * width

                    return (
                      <div
                        key={item.task.id}
                        data-task-block="true"
                        className="absolute rounded-md bg-muted/40 px-1.5 py-0.5 text-left text-[10px] outline outline-1 outline-muted-foreground/20 pointer-events-none"
                        style={{
                          top,
                          height,
                          left: `calc(${left}% + 2px)`,
                          width: `calc(${width}% - 4px)`
                        }}
                      >
                        <div className="font-medium text-muted-foreground/70 line-clamp-1">
                          {item.task.title}
                        </div>
                        <div className="text-[9px] text-muted-foreground/50">
                          {formatTimeRange(item.startDate, item.endDate)}
                        </div>
                      </div>
                    )
                  })}

                  {/* Current task selection */}
                  {selection && (
                    <div
                      className={cn(
                        'absolute left-2 right-2 rounded-md bg-primary/20 outline outline-1 outline-primary/40',
                        isDragging && 'opacity-70'
                      )}
                      style={{ top: selectionTop, height: selectionHeight }}
                    >
                      {/* Top resize handle */}
                      <div
                        className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize hover:bg-primary/30 rounded-t-md"
                        onMouseDown={(event) => handleResizeMouseDown(event, selection, 'top')}
                      />
                      {/* Center area for move */}
                      <div
                        className="absolute left-0 right-0 top-2 bottom-2 cursor-move"
                        onMouseDown={(event) => handleSelectionMouseDown(event, selection)}
                      />
                      {/* Bottom resize handle */}
                      <div
                        className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize hover:bg-primary/30 rounded-b-md"
                        onMouseDown={(event) => handleResizeMouseDown(event, selection, 'bottom')}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Drag to select, move the block, or resize by dragging edges.
      </div>
    </div>
  )
}
