import React, { useState, useRef, useEffect } from 'react'
import { CalendarDays, Check } from 'lucide-react'
import { Button } from './ui/button'
import type { Calendar } from '../gen/api'

interface CalendarFilterDropdownProps {
  /** Synced calendars to display */
  calendars: Calendar[]
  /** Set of visible calendar IDs */
  visibleCalendarIds: Set<string>
  /** Toggle visibility of a calendar */
  onToggleVisibility: (calendarId: string) => void
}

function CalendarColorDot({ color }: { color?: string | null }): React.JSX.Element {
  return (
    <div
      className="h-3 w-3 rounded-full shrink-0"
      style={{ backgroundColor: color ?? '#6366f1' }}
    />
  )
}

export function CalendarFilterDropdown({
  calendars,
  visibleCalendarIds,
  onToggleVisibility
}: CalendarFilterDropdownProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const visibleCount = calendars.filter((c) => visibleCalendarIds.has(String(c.id))).length

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
    return undefined
  }, [isOpen])

  if (calendars.length === 0) {
    return <></>
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarDays className="h-4 w-4" />
        <span>Calendars</span>
        <span className="text-xs text-muted-foreground">
          ({visibleCount}/{calendars.length})
        </span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-48 rounded-md border bg-card p-2">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Show calendars
          </div>
          {calendars.map((calendar) => {
            const calendarIdStr = String(calendar.id)
            const isVisible = visibleCalendarIds.has(calendarIdStr)
            return (
              <button
                key={calendar.id}
                type="button"
                onClick={() => onToggleVisibility(calendarIdStr)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
              >
                <CalendarColorDot color={calendar.color} />
                <span className="flex-1 truncate text-left">{calendar.name}</span>
                {isVisible && <Check className="h-4 w-4 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
