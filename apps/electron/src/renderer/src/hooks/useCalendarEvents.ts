import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGetApiEvents, useGetApiCalendars } from '../gen/api/endpoints/techooAPI.gen'
import type { CalendarEvent as ApiCalendarEvent, Calendar } from '../gen/api/schemas'
import { useCalendarColors } from './useCalendarColors'

const STORAGE_KEY = 'techoo:visible-calendar-ids'

interface UseCalendarEventsOptions {
  startDate: Date
  endDate: Date
  enabled?: boolean
}

export interface UseCalendarEventsReturn {
  events: ApiCalendarEvent[]
  calendars: Calendar[]
  isLoading: boolean
  visibleCalendarIds: Set<string>
  calendarColorMap: Record<string, string>
  toggleCalendarVisibility: (calendarId: string) => void
  setAllCalendarsVisible: (visible: boolean) => void
}

export function useCalendarEvents(
  options: UseCalendarEventsOptions
): UseCalendarEventsReturn {
  const { startDate, endDate, enabled = true } = options

  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [hasInitialized, setHasInitialized] = useState(false)
  const [storageLoaded, setStorageLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        setVisibleCalendarIds(new Set(parsed))
      }
    } catch {
      // ignore
    }
    setStorageLoaded(true)
  }, [])

  const { data: calendarsData, isLoading: isCalendarsLoading } = useGetApiCalendars({
    swr: { enabled }
  })

  const calendars = useMemo(
    () => calendarsData?.calendars ?? [],
    [calendarsData?.calendars]
  )
  const { calendarColorMap } = useCalendarColors(calendars)

  useEffect(() => {
    if (!hasInitialized && storageLoaded && calendars.length > 0) {
      setHasInitialized(true)
      if (visibleCalendarIds.size === 0) {
        const enabledIds = new Set(
          calendars.filter((c) => c.isEnabled).map((c) => String(c.id))
        )
        setVisibleCalendarIds(enabledIds)
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabledIds]))
      }
    }
  }, [calendars, hasInitialized, storageLoaded, visibleCalendarIds.size])

  const params = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    }),
    [startDate, endDate]
  )

  const { data: eventsData, isLoading: isEventsLoading } = useGetApiEvents(params, {
    swr: { enabled }
  })

  const events = useMemo(() => {
    const allEvents = eventsData?.events ?? []
    return allEvents.filter((event) =>
      visibleCalendarIds.has(String(event.calendarId))
    )
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
      const next = visible
        ? new Set(calendars.map((c) => String(c.id)))
        : new Set<string>()
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
    calendarColorMap,
    toggleCalendarVisibility,
    setAllCalendarsVisible
  }
}
