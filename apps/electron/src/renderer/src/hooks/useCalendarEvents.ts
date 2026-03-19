import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  useGetApiEvents,
  useGetApiCalendars,
  type CalendarEvent,
  type Calendar
} from '../gen/api'

const STORAGE_KEY = 'techoo:visible-calendar-ids'

interface UseCalendarEventsOptions {
  /** Start date for event range */
  startDate: Date
  /** End date for event range */
  endDate: Date
  /** Whether to fetch events (defaults to true) */
  enabled?: boolean
}

interface UseCalendarEventsReturn {
  /** Calendar events within the date range */
  events: CalendarEvent[]
  /** Synced calendars */
  calendars: Calendar[]
  /** Whether data is loading */
  isLoading: boolean
  /** Set of visible calendar IDs */
  visibleCalendarIds: Set<string>
  /** Toggle visibility of a calendar */
  toggleCalendarVisibility: (calendarId: string) => void
  /** Set visibility for all calendars */
  setAllCalendarsVisible: (visible: boolean) => void
}

export function useCalendarEvents(options: UseCalendarEventsOptions): UseCalendarEventsReturn {
  const { startDate, endDate, enabled = true } = options

  // Load visibility state from localStorage
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        return new Set(parsed)
      }
    } catch {
      // Ignore parse errors
    }
    return new Set()
  })

  // Track whether we've initialized visibility from synced calendars
  const [hasInitialized, setHasInitialized] = useState(false)

  // Fetch synced calendars
  const { data: calendarsData, isLoading: isCalendarsLoading } = useGetApiCalendars({
    swr: { enabled }
  })

  const calendars = useMemo(
    () => calendarsData?.calendars ?? [],
    [calendarsData?.calendars]
  )

  // Initialize visibility to show all enabled calendars if not set
  useEffect(() => {
    if (!hasInitialized && calendars.length > 0) {
      setHasInitialized(true)
      // Only initialize if no stored preference exists
      if (visibleCalendarIds.size === 0) {
        const enabledIds = new Set(
          calendars.filter((c) => c.isEnabled).map((c) => String(c.id))
        )
        setVisibleCalendarIds(enabledIds)
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabledIds]))
      }
    }
  }, [calendars, hasInitialized, visibleCalendarIds.size])

  // Format dates for API query
  const params = useMemo(() => {
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }
  }, [startDate, endDate])

  // Fetch events
  const { data: eventsData, isLoading: isEventsLoading } = useGetApiEvents(params, {
    swr: { enabled }
  })

  // Filter events to only show visible calendars
  // Note: Always filter by visibleCalendarIds. If user unchecks all calendars,
  // visibleCalendarIds will be empty and no events will show (which is correct).
  const events = useMemo(() => {
    const allEvents = eventsData?.events ?? []
    return allEvents.filter((event) => visibleCalendarIds.has(String(event.calendarId)))
  }, [eventsData?.events, visibleCalendarIds])

  const toggleCalendarVisibility = useCallback((calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) {
        next.delete(calendarId)
      } else {
        next.add(calendarId)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const setAllCalendarsVisible = useCallback(
    (visible: boolean) => {
      const next = visible ? new Set(calendars.map((c) => String(c.id))) : new Set<string>()
      setVisibleCalendarIds(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    },
    [calendars]
  )

  return {
    events,
    calendars,
    isLoading: isCalendarsLoading || isEventsLoading,
    visibleCalendarIds,
    toggleCalendarVisibility,
    setAllCalendarsVisible
  }
}
