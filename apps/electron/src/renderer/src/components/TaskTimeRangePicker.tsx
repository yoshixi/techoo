import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

const SLOT_MINUTES = 15
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES
const MINUTES_PER_DAY = 24 * 60
const SLOT_HEIGHT_PX = 6
const SLOT_COUNT = MINUTES_PER_DAY / SLOT_MINUTES
const VISIBLE_START_HOUR = 6
const VISIBLE_END_HOUR = 18

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
  className?: string
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const startOfWeek = (date: Date): Date => {
  const day = date.getDay()
  const diff = (day + 6) % 7
  const start = new Date(date)
  start.setDate(start.getDate() - diff)
  return startOfDay(start)
}

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

const formatWeekLabel = (start: Date): string => {
  const end = addDays(start, 6)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${startLabel} - ${endLabel}`
}

const formatHourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`

const getSlotIndexFromEvent = (event: MouseEvent, column: HTMLDivElement): number => {
  const rect = column.getBoundingClientRect()
  const offset = event.clientY - rect.top
  const clamped = clamp(offset, 0, rect.height - 1)
  return clamp(Math.floor(clamped / SLOT_HEIGHT_PX), 0, SLOT_COUNT - 1)
}

const minutesFromSlot = (slot: number): number => slot * SLOT_MINUTES

const dateForSlot = (baseDate: Date, slot: number): Date => {
  const minutes = minutesFromSlot(slot)
  const result = new Date(baseDate)
  result.setMinutes(minutes, 0, 0)
  return result
}

const getSelectionFromRange = (
  startAt?: string | null,
  endAt?: string | null,
  dayStart?: Date
): DragSelection | null => {
  if (!startAt || !endAt || !dayStart) return null
  const startDate = new Date(startAt)
  const endDate = new Date(endAt)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  const base = startOfDay(dayStart).getTime()
  const startDayOffset = startOfDay(startDate).getTime() - base
  const endDayOffset = startOfDay(endDate).getTime() - base
  if (startDayOffset !== endDayOffset) return null
  const dayIndex = Math.round(startDayOffset / (24 * 60 * 60 * 1000))
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
  const startSlot = clamp(Math.floor(startMinutes / SLOT_MINUTES), 0, SLOT_COUNT - 1)
  const endSlot = clamp(Math.ceil(endMinutes / SLOT_MINUTES) - 1, 0, SLOT_COUNT - 1)
  return { dayIndex, startSlot, endSlot }
}

/**
 * TaskTimeRangePicker
 * - Day/week timeline with 15-minute slots.
 * - Drag to select a range; emits startAt/endAt on mouse up.
 * - Auto-scrolls to the current selection (or 06:00 by default).
 *
 * Example:
 * <TaskTimeRangePicker
 *   startAt={task.startAt}
 *   endAt={task.endAt}
 *   onChange={({ startAt, endAt }) =>
 *     setTask((prev) => (prev ? { ...prev, startAt, endAt } : prev))
 *   }
 * />
 */
export const TaskTimeRangePicker: React.FC<TaskTimeRangePickerProps> = ({
  startAt,
  endAt,
  onChange,
  className
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()))
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null)
  const [dragMove, setDragMove] = useState<DragMove | null>(null)
  const [dragResize, setDragResize] = useState<DragResize | null>(null)
  const activeColumnRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const dayStart = useMemo(() => startOfDay(anchorDate), [anchorDate])
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const activeBase = viewMode === 'day' ? dayStart : weekStart

  useEffect(() => {
    if (startAt) {
      const startDate = new Date(startAt)
      if (!Number.isNaN(startDate.getTime())) {
        setAnchorDate(startOfDay(startDate))
      }
    }
  }, [startAt])

  useEffect(() => {
    if (!dragSelection) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      if (!activeColumnRef.current) return
      const endSlot = getSlotIndexFromEvent(event, activeColumnRef.current)
      setDragSelection((prev) =>
        prev ? { ...prev, endSlot } : prev
      )
    }

    const handleMouseUp = (): void => {
      if (!dragSelection) return
      const { dayIndex, startSlot, endSlot } = dragSelection
      const [minSlot, maxSlot] = startSlot <= endSlot ? [startSlot, endSlot] : [endSlot, startSlot]
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
      const startDate = dateForSlot(baseDate, minSlot)
      const endDate = dateForSlot(baseDate, maxSlot + 1)
      onChange({ startAt: startDate.toISOString(), endAt: endDate.toISOString() })
      setDragSelection(null)
      activeColumnRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragSelection, activeBase, viewMode, onChange])

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
        const pointerSlot = clamp(Math.floor(clamped / SLOT_HEIGHT_PX), 0, SLOT_COUNT - 1)
        const newStartSlot = clamp(pointerSlot - dragMove.offsetSlot, 0, SLOT_COUNT - dragMove.duration)

        setDragMove((prev) =>
          prev ? { ...prev, dayIndex: targetDayIndex, startSlot: newStartSlot } : prev
        )
      }
    }

    const handleMouseUp = (): void => {
      if (!dragMove) return
      const { dayIndex, startSlot, duration } = dragMove
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dayIndex)
      const startDate = dateForSlot(baseDate, startSlot)
      const endDate = dateForSlot(baseDate, startSlot + duration)
      onChange({ startAt: startDate.toISOString(), endAt: endDate.toISOString() })
      setDragMove(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragMove, activeBase, viewMode, onChange])

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
      const pointerSlot = clamp(Math.floor(clamped / SLOT_HEIGHT_PX), 0, SLOT_COUNT - 1)

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
      const startDate = dateForSlot(baseDate, startSlot)
      const endDate = dateForSlot(baseDate, endSlot + 1)
      onChange({ startAt: startDate.toISOString(), endAt: endDate.toISOString() })
      setDragResize(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragResize, activeBase, viewMode, onChange])

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
    const offsetSlot = Math.floor(offsetY / SLOT_HEIGHT_PX)
    const duration = selection.endSlot - selection.startSlot + 1

    setDragMove({
      dayIndex: selection.dayIndex,
      startSlot: selection.startSlot,
      duration,
      offsetSlot
    })
  }

  const handleColumnMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    dayIndex: number
  ): void => {
    event.preventDefault()
    const column = event.currentTarget
    activeColumnRef.current = column
    const startSlot = getSlotIndexFromEvent(event.nativeEvent, column)
    setDragSelection({ dayIndex, startSlot, endSlot: startSlot })
  }

  const derivedSelection = useMemo(() => {
    const base = viewMode === 'day' ? dayStart : weekStart
    return getSelectionFromRange(startAt, endAt, base)
  }, [startAt, endAt, viewMode, dayStart, weekStart])

  // Convert dragMove to selection format for rendering
  const dragMoveAsSelection: DragSelection | null = dragMove
    ? {
        dayIndex: dragMove.dayIndex,
        startSlot: dragMove.startSlot,
        endSlot: dragMove.startSlot + dragMove.duration - 1
      }
    : null

  const selectionToRender = dragResize ?? dragMoveAsSelection ?? dragSelection ?? derivedSelection
  const isDragging = dragMove !== null || dragResize !== null

  const dayLabels = viewMode === 'day'
    ? [formatDayLabel(dayStart)]
    : Array.from({ length: 7 }, (_, index) => formatDayLabel(addDays(weekStart, index)))

  const totalHeight = SLOT_COUNT * SLOT_HEIGHT_PX

  useEffect(() => {
    if (!scrollContainerRef.current || !selectionToRender) return
    const targetTop = selectionToRender.startSlot * SLOT_HEIGHT_PX
    const container = scrollContainerRef.current
    const centeredTop = Math.max(0, targetTop - container.clientHeight / 2)
    container.scrollTop = centeredTop
  }, [selectionToRender, viewMode])

  useEffect(() => {
    if (!scrollContainerRef.current || selectionToRender) return
    const container = scrollContainerRef.current
    const targetTop = VISIBLE_START_HOUR * SLOTS_PER_HOUR * SLOT_HEIGHT_PX
    container.scrollTop = targetTop
  }, [viewMode, selectionToRender])

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
          style={{
            height:
              (VISIBLE_END_HOUR - VISIBLE_START_HOUR) *
              SLOTS_PER_HOUR *
              SLOT_HEIGHT_PX
          }}
        >
          <div className="w-12 flex-shrink-0">
            <div className="relative" style={{ height: totalHeight }}>
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="absolute left-2 text-[10px] text-muted-foreground"
                  style={{ top: hour * SLOTS_PER_HOUR * SLOT_HEIGHT_PX - 6 }}
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
              const selectionTop = selection ? selection.startSlot * SLOT_HEIGHT_PX : 0
              const selectionHeight = selection
                ? (selection.endSlot - selection.startSlot + 1) * SLOT_HEIGHT_PX
                : 0

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
                      style={{ top: hour * SLOTS_PER_HOUR * SLOT_HEIGHT_PX }}
                    />
                  ))}
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
