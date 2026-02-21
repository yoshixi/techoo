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
} from '@/gen/api/endpoints/shuchuAPI.gen'
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

  const { data: statusData, isLoading: isStatusLoading } = useGetApiOauthGoogleStatus(
    providerAccountId ? { accountId: providerAccountId } : undefined,
    {
      swr: { enabled: Boolean(providerAccountId) },
    }
  )

  const isGoogleConnected = useMemo(() => {
    if (providerAccountId) {
      return statusData?.connected === true
    }
    return googleAccounts.length > 0
  }, [googleAccounts.length, providerAccountId, statusData?.connected])

  const { data: availableData, isLoading: isAvailableLoading } =
    useGetApiCalendarsAvailable(
      { accountId: providerAccountId || '' },
      {
        swr: { enabled: Boolean(providerAccountId && isGoogleConnected) },
      }
    )

  const { data: syncedData, isLoading: isSyncedLoading } = useGetApiCalendars()

  const syncedCalendars = useMemo(() => {
    const calendars = syncedData?.calendars ?? []
    if (!providerAccountId) return calendars
    return calendars.filter(
      (calendar) => calendar.providerAccountId === providerAccountId
    )
  }, [providerAccountId, syncedData?.calendars])

  const refresh = useCallback(async () => {
    await Promise.all([
      mutate(getGetApiOauthGoogleAccountsKey()),
      providerAccountId
        ? mutate(getGetApiOauthGoogleStatusKey({ accountId: providerAccountId }))
        : Promise.resolve(),
      providerAccountId
        ? mutate(getGetApiCalendarsAvailableKey({ accountId: providerAccountId }))
        : Promise.resolve(),
      mutate(getGetApiCalendarsKey()),
      mutate(getGetApiEventsKey()),
    ])
  }, [mutate, providerAccountId])

  const addCalendar = useCallback(
    async (providerCalendarId: string, name: string) => {
      if (!providerAccountId) {
        throw new Error('No provider account selected')
      }
      await postApiCalendars({
        providerAccountId,
        providerCalendarId,
        name,
      })
      await refresh()
    },
    [providerAccountId, refresh]
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
