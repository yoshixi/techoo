import { useCallback, useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useSWRConfig } from 'swr'
import {
  useGetApiCalendars,
  postApiCalendarsSync,
  getGetApiCalendarsKey,
  getGetApiEventsKey,
} from '@/gen/api/endpoints/techooAPI.gen'
import type { Calendar } from '@/gen/api/schemas'

/** Sync if any enabled calendar is older than this. */
const STALE_MS = 15 * 60 * 1000
/** Minimum gap between sync attempts from this client. */
const DEBOUNCE_MS = 60 * 1000

/** Shared across hook instances so multiple calendar surfaces don't double-sync. */
let globalInFlight = false
let globalLastAttempt = 0

function isCalendarStale(calendar: Calendar, now: number): boolean {
  if (!calendar.isEnabled) return false
  if (!calendar.lastSyncedAt) return true
  const syncedAt = new Date(calendar.lastSyncedAt).getTime()
  if (Number.isNaN(syncedAt)) return true
  return now - syncedAt > STALE_MS
}

/**
 * When the calendar UI is mounted, sync enabled Google calendars if stale.
 * Re-checks on AppState → active. Does not block the timeline; failures are silent.
 */
export function useCalendarAutoSync(enabled = true): void {
  const { mutate } = useSWRConfig()
  const { data: calendarsData } = useGetApiCalendars({
    swr: { enabled },
  })
  // Keep a ref so the AppState listener always sees the latest maybeSync
  const maybeSyncRef = useRef<() => Promise<void>>(async () => {})

  const maybeSync = useCallback(async () => {
    if (!enabled) return
    if (globalInFlight) return

    const now = Date.now()
    if (now - globalLastAttempt < DEBOUNCE_MS) return

    const calendars = calendarsData?.calendars ?? []
    const enabledCalendars = calendars.filter((c) => c.isEnabled)
    if (enabledCalendars.length === 0) return

    const needsSync = enabledCalendars.some((c) => isCalendarStale(c, now))
    if (!needsSync) return

    globalInFlight = true
    globalLastAttempt = now
    try {
      await postApiCalendarsSync()
      await Promise.all([
        mutate(getGetApiCalendarsKey()),
        // Match parameterized event keys: ['/api/events', params]
        mutate(
          (key) => Array.isArray(key) && key[0] === getGetApiEventsKey()[0]
        ),
      ])
    } catch (error) {
      if (__DEV__) {
        console.debug('Calendar auto-sync failed', error)
      }
    } finally {
      globalInFlight = false
    }
  }, [calendarsData?.calendars, enabled, mutate])

  maybeSyncRef.current = maybeSync

  // Run when calendars data arrives / updates while mounted
  useEffect(() => {
    void maybeSync()
  }, [maybeSync])

  // Re-check when returning to foreground
  useEffect(() => {
    if (!enabled) return

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        void maybeSyncRef.current()
      }
    }
    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [enabled])
}
