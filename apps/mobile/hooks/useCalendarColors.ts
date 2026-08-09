import { useCallback, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  CALENDAR_COLORS_STORAGE_KEY,
  calendarColorsEqual,
  mergeCalendarColors,
  normalizeHexColor,
} from '@/lib/calendar-colors'

export interface UseCalendarColorsReturn {
  calendarColorMap: Record<string, string>
  setCalendarColor: (calendarId: string, color: string) => void
}

/**
 * Randomly assigns palette colors to newly seen calendars and persists
 * user-chosen overrides in AsyncStorage.
 */
export function useCalendarColors(
  calendars: { id: string }[]
): UseCalendarColorsReturn {
  const [stored, setStored] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  const calendarIds = useMemo(
    () => calendars.map((c) => String(c.id)),
    [calendars]
  )
  const calendarIdsKey = calendarIds.join(',')

  useEffect(() => {
    void AsyncStorage.getItem(CALENDAR_COLORS_STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setStored(JSON.parse(raw) as Record<string, string>)
        } catch {
          // ignore
        }
      }
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return

    setStored((prev) => {
      const merged = mergeCalendarColors(calendarIds, prev, Math.random)
      if (calendarColorsEqual(merged, prev)) return prev
      void AsyncStorage.setItem(CALENDAR_COLORS_STORAGE_KEY, JSON.stringify(merged))
      return merged
    })
  }, [loaded, calendarIdsKey, calendarIds])

  const setCalendarColor = useCallback((calendarId: string, color: string) => {
    const normalized = normalizeHexColor(color)
    if (!normalized) return
    setStored((prev) => {
      const next = { ...prev, [calendarId]: normalized }
      void AsyncStorage.setItem(CALENDAR_COLORS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const calendarColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const id of calendarIds) {
      if (stored[id]) map[id] = stored[id]
    }
    return map
  }, [calendarIds, calendarIdsKey, stored])

  return { calendarColorMap, setCalendarColor }
}
