import React, { useMemo } from 'react'
import { Badge } from '../ui/badge'
import { formatDurationShort } from '../../lib/timer-aggregation'
import type { SessionTimelineEntry } from '../../lib/timer-aggregation'
import type { Task } from '../../gen/api'
import {
  HOUR_LABEL_VERTICAL_OFFSET,
  clamp,
  formatHourLabel,
  formatTimeRange
} from '../../lib/calendar-utils'

interface DayTimelineProps {
  sessions: SessionTimelineEntry[]
  onTaskSelect: (task: Task) => void
  showLiveIndicator?: boolean
}

// Fixed layout constants
const SLOT_MINUTES = 15
const SLOTS_PER_HOUR = 60 / SLOT_MINUTES
const SLOT_HEIGHT = 12 // px per slot

interface SessionLayout {
  entry: SessionTimelineEntry
  startSlot: number
  endSlot: number
  lane: number
  laneCount: number
}

function calculateSessionLayouts(sessions: SessionTimelineEntry[]): SessionLayout[] {
  const items: SessionLayout[] = sessions.map((entry) => {
    const start = new Date(entry.timer.startTime)
    const end = entry.timer.endTime ? new Date(entry.timer.endTime) : new Date()
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    const totalSlots = 24 * SLOTS_PER_HOUR

    const startSlot = clamp(Math.floor(startMinutes / SLOT_MINUTES), 0, totalSlots - 1)
    const endSlot = clamp(Math.ceil(endMinutes / SLOT_MINUTES), startSlot + 1, totalSlots)

    return { entry, startSlot, endSlot, lane: 0, laneCount: 1 }
  })

  // Assign lanes for overlapping sessions
  const sorted = [...items].sort((a, b) => {
    if (a.startSlot === b.startSlot) return a.endSlot - b.endSlot
    return a.startSlot - b.startSlot
  })

  const lanesEnd: number[] = []
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

export function DayTimeline({
  sessions,
  onTaskSelect,
  showLiveIndicator = false
}: DayTimelineProps): React.JSX.Element {
  const layouts = useMemo(() => calculateSessionLayouts(sessions), [sessions])

  // Visible hour range: default 7:00–24:00, but pull start earlier if any session begins before 7am
  const { startHour, endHour } = useMemo(() => {
    const defaultStart = 7
    if (layouts.length === 0) return { startHour: defaultStart, endHour: 24 }
    const earliestHour = Math.floor((Math.min(...layouts.map((l) => l.startSlot)) * SLOT_MINUTES) / 60)
    const s = earliestHour < defaultStart ? Math.max(0, earliestHour) : defaultStart
    return { startHour: s, endHour: 24 }
  }, [layouts])

  const startSlotOffset = startHour * SLOTS_PER_HOUR
  const visibleSlots = (endHour - startHour) * SLOTS_PER_HOUR
  const visibleHeight = visibleSlots * SLOT_HEIGHT

  // Current time indicator
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowSlot = nowMinutes / SLOT_MINUTES
  const showNowLine = showLiveIndicator && nowSlot >= startSlotOffset && nowSlot <= startSlotOffset + visibleSlots

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No sessions recorded.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex" style={{ height: visibleHeight }}>
        {/* Hour labels gutter */}
        <div className="relative w-10 flex-shrink-0">
          {Array.from({ length: endHour - startHour }, (_, i) => {
            const hour = startHour + i
            return (
              <div
                key={hour}
                className="absolute left-1 text-[10px] text-muted-foreground"
                style={{ top: i * SLOTS_PER_HOUR * SLOT_HEIGHT - HOUR_LABEL_VERTICAL_OFFSET }}
              >
                {formatHourLabel(hour)}
              </div>
            )
          })}
        </div>

        {/* Timeline column */}
        <div className="relative flex-1 min-w-0">
          {/* Hour grid lines */}
          {Array.from({ length: endHour - startHour }, (_, i) => (
            <div
              key={`line-${i}`}
              className="absolute left-0 right-0 border-t border-muted-foreground/15"
              style={{ top: i * SLOTS_PER_HOUR * SLOT_HEIGHT }}
            />
          ))}

          {/* Current time indicator */}
          {showNowLine && (
            <div
              className="absolute left-0 right-0 z-20 h-px bg-primary/70"
              style={{ top: (nowSlot - startSlotOffset) * SLOT_HEIGHT }}
            >
              <div className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
            </div>
          )}

          {/* Session blocks */}
          {layouts.map((layout) => {
            const top = (layout.startSlot - startSlotOffset) * SLOT_HEIGHT
            const height = Math.max(SLOT_HEIGHT, (layout.endSlot - layout.startSlot) * SLOT_HEIGHT)
            const width = 100 / layout.laneCount
            const left = layout.lane * width
            const isActive = !layout.entry.timer.endTime
            const startDate = new Date(layout.entry.timer.startTime)
            const endDate = layout.entry.timer.endTime
              ? new Date(layout.entry.timer.endTime)
              : new Date()

            return (
              <button
                key={layout.entry.timer.id}
                type="button"
                onClick={() => onTaskSelect(layout.entry.task)}
                className={`absolute rounded-md px-2 py-0.5 text-left text-xs outline outline-1 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-primary/20 outline-primary/40 hover:bg-primary/30'
                    : 'bg-primary/10 outline-primary/25 hover:bg-primary/20'
                }`}
                style={{
                  top,
                  height,
                  left: `${left}%`,
                  width: `${width}%`
                }}
              >
                <div className="flex items-start justify-between gap-1 overflow-hidden h-full">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground/90 line-clamp-1">
                      {layout.entry.task.title}
                    </div>
                    {height >= SLOT_HEIGHT * 2 && (
                      <div className="text-[10px] text-muted-foreground">
                        {formatTimeRange(startDate, endDate)}
                      </div>
                    )}
                    {height >= SLOT_HEIGHT * 3 && layout.entry.task.tags && layout.entry.task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {layout.entry.task.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-[9px] px-1 py-0 leading-tight">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-[10px] font-mono text-muted-foreground">
                    {isActive && showLiveIndicator ? (
                      <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        live
                      </span>
                    ) : (
                      formatDurationShort(layout.entry.durationMs)
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
