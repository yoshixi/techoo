import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Play, Square, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import type { Task, TaskTimer } from '../gen/api'

const SLOT_MINUTES = 15
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES
const MINUTES_PER_DAY = 24 * 60
const SLOT_COUNT = MINUTES_PER_DAY / SLOT_MINUTES
const DEFAULT_DURATION_MINUTES = 30
const DAY_MS = 24 * 60 * 60 * 1000
const VISIBLE_START_HOUR = 6
const VISIBLE_END_HOUR = 18
const MIN_SLOT_HEIGHT_PX = 4

export type ViewMode = 'day' | 'week'

type TaskLayout = {
  task: Task
  dayIndex: number
  startSlot: number
  endSlot: number
  lane: number
  laneCount: number
  startDate: Date
  endDate: Date
}

type CalendarViewProps = {
  tasks: Task[]
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  onTaskSelect?: (task: Task) => void
  onTaskEdit?: (task: Task) => void
  onTaskDelete?: (task: Task) => void
  onTaskMove?: (task: Task, range: { startAt: string; endAt: string }) => void
  activeTimersByTaskId?: Map<string, TaskTimer>
  onTaskStartTimer?: (taskId: string) => void
  onTaskStopTimer?: (taskId: string, timerId: string) => void
  onCreateRange?: (range: { startAt: string; endAt: string }) => void
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

const formatTimeRange = (start: Date, end: Date): string =>
  `${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`

const computeTaskEnd = (start: Date, endAt?: string | null): Date => {
  if (endAt) {
    const parsed = new Date(endAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000)
}

const getSlotIndexFromEvent = (
  event: MouseEvent,
  column: HTMLDivElement,
  slotHeight: number
): number => {
  const rect = column.getBoundingClientRect()
  const offset = event.clientY - rect.top
  const clamped = clamp(offset, 0, rect.height - 1)
  return clamp(Math.floor(clamped / slotHeight), 0, SLOT_COUNT - 1)
}

const dateForSlot = (baseDate: Date, slot: number): Date => {
  const minutes = slot * SLOT_MINUTES
  const result = new Date(baseDate)
  result.setMinutes(minutes, 0, 0)
  return result
}

const assignLanes = (tasks: TaskLayout[]): TaskLayout[] => {
  const lanesEnd: number[] = []
  const sorted = [...tasks].sort((a, b) => {
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
  const [anchorDate, setAnchorDate] = useState<Date>(() => startOfDay(new Date()))
  const [now, setNow] = useState<Date>(() => new Date())
  const [slotHeight, setSlotHeight] = useState<number>(6)
  const [dragSelection, setDragSelection] = useState<{
    dayIndex: number
    startSlot: number
    endSlot: number
  } | null>(null)
  const [dragTask, setDragTask] = useState<{
    task: Task
    dayIndex: number
    durationSlots: number
    offsetSlots: number
    startSlot: number
  } | null>(null)
  const [dragResize, setDragResize] = useState<{
    task: Task
    dayIndex: number
    startSlot: number
    endSlot: number
    edge: 'top' | 'bottom'
  } | null>(null)
  const [didDragTask, setDidDragTask] = useState(false)
  const activeColumnRef = React.useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)

  const dayStart = useMemo(() => startOfDay(anchorDate), [anchorDate])
  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])
  const activeBase = viewMode === 'day' ? dayStart : weekStart
  const dayCount = viewMode === 'day' ? 1 : 7

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
        endDate = new Date(startDate.getTime() + SLOT_MINUTES * 60 * 1000)
      }
      const endMinutesRaw = endDate.getHours() * 60 + endDate.getMinutes()
      const endMinutes = clamp(endMinutesRaw, 0, MINUTES_PER_DAY)

      const startSlot = clamp(Math.floor(startMinutes / SLOT_MINUTES), 0, SLOT_COUNT - 1)
      const endSlot = clamp(Math.ceil(endMinutes / SLOT_MINUTES), startSlot + 1, SLOT_COUNT)

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
  }, [tasks, activeBase, dayCount])

  React.useEffect(() => {
    if (!dragSelection) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      if (!activeColumnRef.current) return
      const endSlot = getSlotIndexFromEvent(event, activeColumnRef.current, slotHeight)
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
  }, [dragSelection, activeBase, viewMode, onCreateRange])

  React.useEffect(() => {
    if (!dragTask) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      const column = hit?.closest('[data-day-index]') as HTMLDivElement | null
      if (!column) return
      activeColumnRef.current = column
      setDidDragTask(true)
      const dayIndex = Number(column.dataset.dayIndex ?? 0)
      const rawSlot = getSlotIndexFromEvent(event, column, slotHeight)
      const clampedStart = clamp(
        rawSlot - dragTask.offsetSlots,
        0,
        SLOT_COUNT - dragTask.durationSlots
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
      const startDate = dateForSlot(baseDate, dragTask.startSlot)
      const endDate = dateForSlot(baseDate, dragTask.startSlot + dragTask.durationSlots)
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
  }, [dragTask, activeBase, viewMode, onTaskMove])

  // Effect for drag-to-resize task
  React.useEffect(() => {
    if (!dragResize) return undefined

    const handleMouseMove = (event: MouseEvent): void => {
      const hit = document.elementFromPoint(event.clientX, event.clientY)
      const column = hit?.closest('[data-day-index]') as HTMLDivElement | null
      if (!column) return

      const pointerSlot = getSlotIndexFromEvent(event, column, slotHeight)

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
          const newEndSlot = clamp(pointerSlot + 1, prev.startSlot + 1, SLOT_COUNT)
          return { ...prev, endSlot: newEndSlot }
        }
      })
    }

    const handleMouseUp = (): void => {
      if (!dragResize) return
      const baseDate = addDays(activeBase, viewMode === 'day' ? 0 : dragResize.dayIndex)
      const startDate = dateForSlot(baseDate, dragResize.startSlot)
      const endDate = dateForSlot(baseDate, dragResize.endSlot)
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
  }, [dragResize, activeBase, viewMode, onTaskMove, slotHeight])

  React.useEffect(() => {
    if (!scrollContainerRef.current) return
    const targetTop = VISIBLE_START_HOUR * SLOTS_PER_HOUR * slotHeight
    scrollContainerRef.current.scrollTop = targetTop
  }, [viewMode, slotHeight])

  React.useEffect(() => {
    if (!scrollContainerRef.current) return
    const container = scrollContainerRef.current
    const visibleSlots = (VISIBLE_END_HOUR - VISIBLE_START_HOUR) * SLOTS_PER_HOUR

    // Slot height is derived from the scroll container height so the visible window
    // (06:00-18:00) fills the available space without leaving empty gaps.
    const updateSlotHeight = () => {
      const nextHeight = Math.max(
        MIN_SLOT_HEIGHT_PX,
        Math.floor(container.clientHeight / visibleSlots)
      )
      setSlotHeight(nextHeight)
    }

    updateSlotHeight()

    const observer = new ResizeObserver(updateSlotHeight)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date())
    }, 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

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
    const startSlot = getSlotIndexFromEvent(event.nativeEvent, column, slotHeight)
    setDragSelection({ dayIndex, startSlot, endSlot: startSlot })
  }

  const handleTaskMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>,
    item: TaskLayout
  ): void => {
    if ((event.target as HTMLElement).closest('[data-task-action="true"]')) {
      return
    }
    event.preventDefault()
    setDidDragTask(false)
    const column = event.currentTarget.closest('[data-day-index]') as HTMLDivElement | null
    if (!column) return
    activeColumnRef.current = column
    const slotAtPointer = getSlotIndexFromEvent(event.nativeEvent, column, slotHeight)
    const durationSlots = Math.max(1, item.endSlot - item.startSlot)
    setDragTask({
      task: item.task,
      dayIndex: item.dayIndex,
      durationSlots,
      offsetSlots: clamp(slotAtPointer - item.startSlot, 0, durationSlots - 1),
      startSlot: item.startSlot
    })
  }

  const handleResizeMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    item: TaskLayout,
    edge: 'top' | 'bottom'
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    setDidDragTask(true)
    setDragResize({
      task: item.task,
      dayIndex: item.dayIndex,
      startSlot: item.startSlot,
      endSlot: item.endSlot,
      edge
    })
  }

  const dayLabels = viewMode === 'day'
    ? [formatDayLabel(dayStart)]
    : Array.from({ length: 7 }, (_, index) => formatDayLabel(addDays(weekStart, index)))

  const totalHeight = SLOT_COUNT * slotHeight

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
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="absolute left-2 text-[10px] text-muted-foreground"
                  style={{ top: hour * SLOTS_PER_HOUR * slotHeight - 6 }}
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
                Math.round(nowMinutes / SLOT_MINUTES) * slotHeight,
                0,
                SLOT_COUNT * slotHeight
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
                      style={{ top: hour * SLOTS_PER_HOUR * slotHeight }}
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
