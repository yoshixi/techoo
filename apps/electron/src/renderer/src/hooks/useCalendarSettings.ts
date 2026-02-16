import { useCallback, useMemo } from 'react'
import useSwr, { useSWRConfig } from 'swr'
import {
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
  createdAt: string
  updatedAt: string
}

type OAuthAccountsResponse = {
  accounts: OAuthAccount[]
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

type AvailableCalendarsResponse = {
  calendars: AvailableCalendarWithAccount[]
}

export type CalendarWithAccount = Calendar & {
  providerAccountId: string
}

interface UseCalendarSettingsReturn {
  /** Whether Google OAuth is connected */
  isGoogleConnected: boolean
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

const getGoogleAccountsKey = () => ['/api/oauth/google/accounts'] as const
const getGoogleStatusKey = (accountId: string) => ['/api/oauth/google/status', accountId] as const
const getAvailableCalendarsKey = (accountId: string) =>
  ['/api/calendars/available', accountId] as const

export function useCalendarSettings(
  providerAccountId?: string
): UseCalendarSettingsReturn {
  const { mutate } = useSWRConfig()

  const { data: accountsData, isLoading: isAccountsLoading } = useSwr(
    getGoogleAccountsKey(),
    () =>
      customInstance<OAuthAccountsResponse>({
        url: '/api/oauth/google/accounts',
        method: 'GET'
      })
  )

  const googleAccounts = useMemo(
    () => accountsData?.accounts ?? [],
    [accountsData?.accounts]
  )

  const { data: statusData, isLoading: isStatusLoading } = useSwr(
    providerAccountId ? getGoogleStatusKey(providerAccountId) : null,
    () =>
      customInstance<OAuthStatusResponse>({
        url: '/api/oauth/google/status',
        method: 'GET',
        params: { accountId: providerAccountId }
      })
  )

  const isGoogleConnected = useMemo(() => {
    if (providerAccountId) {
      return statusData?.connected === true
    }
    return googleAccounts.length > 0
  }, [googleAccounts.length, providerAccountId, statusData?.connected])

  // Get available calendars from Google
  const { data: availableData, isLoading: isAvailableLoading } = useSwr(
    providerAccountId && isGoogleConnected
      ? getAvailableCalendarsKey(providerAccountId)
      : null,
    () =>
      customInstance<AvailableCalendarsResponse>({
        url: '/api/calendars/available',
        method: 'GET',
        params: { accountId: providerAccountId }
      })
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
      mutate(getGoogleAccountsKey()),
      providerAccountId ? mutate(getGoogleStatusKey(providerAccountId)) : Promise.resolve(),
      providerAccountId ? mutate(getAvailableCalendarsKey(providerAccountId)) : Promise.resolve(),
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
