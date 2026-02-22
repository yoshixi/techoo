import { useCallback, useMemo } from 'react'
import { useSWRConfig } from 'swr'
import {
  useGetApiOauthGoogleAccounts,
  getGetApiOauthGoogleAccountsKey,
  useGetApiOauthGoogleStatus,
  getGetApiOauthGoogleStatusKey,
  useGetApiCalendarsAvailable,
  getGetApiCalendarsAvailableKey,
  useGetApiCalendars,
  postApiCalendars,
  patchApiCalendarsId,
  deleteApiCalendarsId,
  postApiCalendarsIdSync,
  getGetApiCalendarsKey,
  getGetApiEventsKey,
} from '@/gen/api/endpoints/comoriAPI.gen'
import type {
  Calendar,
  AvailableCalendar,
  OAuthAccount,
} from '@/gen/api/schemas'

interface UseCalendarSettingsReturn {
  isGoogleConnected: boolean
  isLoading: boolean
  googleAccounts: OAuthAccount[]
  availableCalendars: AvailableCalendar[]
  syncedCalendars: Calendar[]
  addCalendar: (providerCalendarId: string, name: string) => Promise<void>
  removeCalendar: (calendarId: string) => Promise<void>
  toggleCalendarEnabled: (calendarId: string, enabled: boolean) => Promise<void>
  syncCalendar: (calendarId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useCalendarSettings(
  providerAccountId?: string
): UseCalendarSettingsReturn {
  const { mutate } = useSWRConfig()

  const { data: accountsData, isLoading: isAccountsLoading } =
    useGetApiOauthGoogleAccounts()

  const googleAccounts = useMemo(
    () => accountsData?.accounts ?? [],
    [accountsData?.accounts]
  )

  // Default to first account when none is explicitly selected
  const effectiveAccountId = providerAccountId ?? googleAccounts[0]?.accountId

  const { data: statusData, isLoading: isStatusLoading } = useGetApiOauthGoogleStatus(
    effectiveAccountId ? { accountId: effectiveAccountId } : undefined,
    {
      swr: { enabled: Boolean(effectiveAccountId) },
    }
  )

  const isGoogleConnected = useMemo(() => {
    if (effectiveAccountId) {
      return statusData?.connected === true
    }
    return googleAccounts.length > 0
  }, [googleAccounts.length, effectiveAccountId, statusData?.connected])

  const { data: availableData, isLoading: isAvailableLoading } =
    useGetApiCalendarsAvailable(
      { accountId: effectiveAccountId || '' },
      {
        swr: { enabled: Boolean(effectiveAccountId) },
      }
    )

  const { data: syncedData, isLoading: isSyncedLoading } = useGetApiCalendars()

  const syncedCalendars = useMemo(() => {
    const calendars = syncedData?.calendars ?? []
    if (!effectiveAccountId) return calendars
    return calendars.filter(
      (calendar) => calendar.providerAccountId === effectiveAccountId
    )
  }, [effectiveAccountId, syncedData?.calendars])

  const refresh = useCallback(async () => {
    await Promise.all([
      mutate(getGetApiOauthGoogleAccountsKey()),
      effectiveAccountId
        ? mutate(getGetApiOauthGoogleStatusKey({ accountId: effectiveAccountId }))
        : Promise.resolve(),
      effectiveAccountId
        ? mutate(getGetApiCalendarsAvailableKey({ accountId: effectiveAccountId }))
        : Promise.resolve(),
      mutate(getGetApiCalendarsKey()),
      mutate(getGetApiEventsKey()),
    ])
  }, [mutate, effectiveAccountId])

  const addCalendar = useCallback(
    async (providerCalendarId: string, name: string) => {
      if (!effectiveAccountId) {
        throw new Error('No provider account selected')
      }
      await postApiCalendars({
        providerAccountId: effectiveAccountId,
        providerCalendarId,
        name,
      })
      await refresh()
    },
    [effectiveAccountId, refresh]
  )

  const removeCalendar = useCallback(
    async (calendarId: string) => {
      await deleteApiCalendarsId(Number(calendarId))
      await refresh()
    },
    [refresh]
  )

  const toggleCalendarEnabled = useCallback(
    async (calendarId: string, enabled: boolean) => {
      await patchApiCalendarsId(Number(calendarId), { isEnabled: enabled })
      await mutate(getGetApiCalendarsKey())
    },
    [mutate]
  )

  const syncCalendar = useCallback(
    async (calendarId: string) => {
      await postApiCalendarsIdSync(Number(calendarId))
      await Promise.all([mutate(getGetApiCalendarsKey()), mutate(getGetApiEventsKey())])
    },
    [mutate]
  )

  return {
    isGoogleConnected,
    isLoading:
      isAccountsLoading || isStatusLoading || isAvailableLoading || isSyncedLoading,
    googleAccounts,
    availableCalendars: availableData?.calendars ?? [],
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar,
    refresh,
  }
}
