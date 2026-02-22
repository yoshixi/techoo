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
  patchApiCalendarsId,
  deleteApiCalendarsId,
  postApiCalendarsIdSync,
  getGetApiCalendarsKey,
  getGetApiEventsKey,
  type Calendar
} from '../gen/api'
import { customInstance } from '../lib/api/mutator'

type OAuthAccount = {
  id: string
  userId: string
  providerType: string
  accountId: string
  email?: string
  createdAt: string
  updatedAt: string
}

type OAuthStatusResponse = {
  connected: boolean
  providerType?: string
  expiresAt?: string | null
}

export type AvailableCalendarWithAccount = {
  providerAccountId: string
  providerCalendarId: string
  name: string
  color?: string
  isPrimary?: boolean
  isAlreadyAdded: boolean
}

export type CalendarWithAccount = Calendar & {
  providerAccountId: string
}

interface UseCalendarSettingsReturn {
  /** Whether Google OAuth is connected */
  isGoogleConnected: boolean
  /** Whether the selected account is explicitly disconnected (status loaded and says disconnected) */
  isExplicitlyDisconnected: boolean
  /** Whether data is loading */
  isLoading: boolean
  /** Linked Google accounts */
  googleAccounts: OAuthAccount[]
  /** Selected account status */
  selectedAccountStatus: OAuthStatusResponse | null
  /** Available calendars from Google (not yet synced) */
  availableCalendars: AvailableCalendarWithAccount[]
  /** Synced calendars (in our DB) */
  syncedCalendars: CalendarWithAccount[]
  /** Add a calendar to sync */
  addCalendar: (providerCalendarId: string, name: string) => Promise<void>
  /** Remove a calendar */
  removeCalendar: (calendarId: string) => Promise<void>
  /** Toggle calendar enabled state */
  toggleCalendarEnabled: (calendarId: string, enabled: boolean) => Promise<void>
  /** Sync a calendar */
  syncCalendar: (calendarId: string) => Promise<void>
  /** Refresh data */
  refresh: () => Promise<void>
}

export function useCalendarSettings(
  providerAccountId?: string
): UseCalendarSettingsReturn {
  const { mutate } = useSWRConfig()

  const { data: accountsData, isLoading: isAccountsLoading } =
    useGetApiOauthGoogleAccounts()

  const googleAccounts = useMemo(
    () =>
      (accountsData?.accounts ?? []).map((account) => {
        const rawAccount = account as OAuthAccount & {
          providerEmail?: string
          provider_email?: string
        }
        const email =
          account.email ||
          rawAccount.providerEmail ||
          rawAccount.provider_email ||
          undefined

        return {
          ...account,
          email
        }
      }),
    [accountsData?.accounts]
  )

  const { data: statusData, isLoading: isStatusLoading } = useGetApiOauthGoogleStatus(
    providerAccountId ? { accountId: providerAccountId } : undefined,
    {
      swr: { enabled: Boolean(providerAccountId) }
    }
  )

  // Whether the selected account is explicitly disconnected (token expired, etc.)
  const isExplicitlyDisconnected = useMemo(() => {
    if (!providerAccountId) return false
    // Only treat as disconnected when status has loaded and says so
    return statusData !== undefined && statusData?.connected === false
  }, [providerAccountId, statusData])

  const isGoogleConnected = useMemo(() => {
    if (providerAccountId) {
      // Treat as connected while status is loading (optimistic)
      // Only false when status explicitly says disconnected
      return !isExplicitlyDisconnected
    }
    return googleAccounts.length > 0
  }, [googleAccounts.length, providerAccountId, isExplicitlyDisconnected])

  // Get available calendars from Google
  const { data: availableData, isLoading: isAvailableLoading } =
    useGetApiCalendarsAvailable(
      { accountId: providerAccountId || '' },
      {
        swr: { enabled: Boolean(providerAccountId && isGoogleConnected) }
      }
    )

  // Get synced calendars from our DB
  const { data: syncedData, isLoading: isSyncedLoading } = useGetApiCalendars({
    swr: {}
  })

  const syncedCalendars = useMemo(() => {
    const calendars = (syncedData?.calendars ?? []) as CalendarWithAccount[]
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
      mutate(getGetApiEventsKey())
    ])
  }, [mutate, providerAccountId])

  const addCalendar = useCallback(
    async (providerCalendarId: string, name: string) => {
      if (!providerAccountId) {
        throw new Error('No provider account selected')
      }
      await customInstance({
        url: '/api/calendars',
        method: 'POST',
        data: {
          providerAccountId,
          providerCalendarId,
          name
        }
      })
      await refresh()
    },
    [providerAccountId, refresh]
  )

  const removeCalendar = useCallback(
    async (calendarId: string) => {
      const calendarIdNum = parseInt(calendarId, 10)
      await deleteApiCalendarsId(calendarIdNum)
      await refresh()
    },
    [refresh]
  )

  const toggleCalendarEnabled = useCallback(
    async (calendarId: string, enabled: boolean) => {
      const calendarIdNum = parseInt(calendarId, 10)
      await patchApiCalendarsId(calendarIdNum, { isEnabled: enabled })
      await mutate(getGetApiCalendarsKey())
    },
    [mutate]
  )

  const syncCalendar = useCallback(
    async (calendarId: string) => {
      const calendarIdNum = parseInt(calendarId, 10)
      await postApiCalendarsIdSync(calendarIdNum)
      await Promise.all([mutate(getGetApiCalendarsKey()), mutate(getGetApiEventsKey())])
    },
    [mutate]
  )

  return {
    isGoogleConnected,
    isExplicitlyDisconnected,
    isLoading:
      isAccountsLoading || isStatusLoading || isAvailableLoading || isSyncedLoading,
    googleAccounts,
    selectedAccountStatus: statusData ?? null,
    availableCalendars: availableData?.calendars ?? [],
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar,
    refresh
  }
}
