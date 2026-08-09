import { useCallback, useMemo } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import {
  useGetApiOauthGoogleAccounts,
  getGetApiOauthGoogleAccountsKey,
  getGetApiOauthGoogleStatusKey,
  getApiCalendarsAvailable,
  getGetApiCalendarsAvailableKey,
  useGetApiCalendars,
  postApiCalendars,
  patchApiCalendarsId,
  deleteApiCalendarsId,
  postApiCalendarsIdSync,
  getGetApiCalendarsKey,
  getGetApiEventsKey
} from '../gen/api/endpoints/techooAPI.gen'
import type { Calendar, AvailableCalendar, OAuthAccount } from '../gen/api/schemas'

export type CalendarSettingsRow = {
  key: string
  providerAccountId: string
  providerCalendarId: string
  name: string
  isPrimary?: boolean
  googleColor?: string
  synced?: Calendar
  isOn: boolean
}

export type CalendarAccountGroup = {
  accountId: string
  label: string
  provider: 'google'
  calendars: CalendarSettingsRow[]
  error: string | null
}

export interface UseCalendarSettingsReturn {
  isGoogleConnected: boolean
  isLoading: boolean
  googleAccounts: OAuthAccount[]
  accountGroups: CalendarAccountGroup[]
  syncedCalendars: Calendar[]
  addCalendar: (
    providerAccountId: string,
    providerCalendarId: string,
    name: string
  ) => Promise<void>
  removeCalendar: (calendarId: string) => Promise<void>
  toggleCalendarEnabled: (calendarId: string, enabled: boolean) => Promise<void>
  syncCalendar: (calendarId: string) => Promise<void>
  refresh: () => Promise<void>
}

function messageFromAvailableError(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) {
    const match = /^HTTP (\d{3}):\s*(.*)$/s.exec(error.message)
    if (match) {
      const status = Number(match[1])
      const body = match[2]
      try {
        const parsed = JSON.parse(body) as { error?: string }
        if (parsed.error) return parsed.error
      } catch {
        // fall through
      }
      if (status === 401) {
        return 'Google session expired; re-link your Google account.'
      }
      if (status === 403) {
        return 'Calendar access was denied. Re-link Google, or enable the Calendar API in Google Cloud Console.'
      }
    }
    return error.message
  }
  return 'Failed to load available calendars.'
}

function buildRowsForAccount(
  availableCalendars: AvailableCalendar[],
  syncedCalendars: Calendar[]
): CalendarSettingsRow[] {
  const syncedByProviderId = new Map(
    syncedCalendars.map((calendar) => [calendar.providerCalendarId, calendar])
  )
  return availableCalendars.map((cal) => {
    const synced = syncedByProviderId.get(cal.providerCalendarId)
    return {
      key: `${cal.providerAccountId}:${cal.providerCalendarId}`,
      providerAccountId: cal.providerAccountId,
      providerCalendarId: cal.providerCalendarId,
      name: cal.name,
      isPrimary: cal.isPrimary,
      googleColor: cal.color,
      synced,
      isOn: Boolean(synced)
    }
  })
}

type AvailableByAccount = Record<
  string,
  { calendars: AvailableCalendar[]; error: string | null }
>

export function useCalendarSettings(): UseCalendarSettingsReturn {
  const { mutate } = useSWRConfig()

  const { data: accountsData, isLoading: isAccountsLoading } =
    useGetApiOauthGoogleAccounts()

  const googleAccounts = useMemo(
    () => accountsData?.accounts ?? [],
    [accountsData?.accounts]
  )

  const accountIdsKey = useMemo(
    () => googleAccounts.map((account) => account.accountId).join('|'),
    [googleAccounts]
  )

  const {
    data: availableByAccount,
    isLoading: isAvailableLoading
  } = useSWR<AvailableByAccount>(
    accountIdsKey ? ['available-calendars-by-account', accountIdsKey] : null,
    async () => {
      const entries = await Promise.all(
        googleAccounts.map(async (account) => {
          try {
            const response = await getApiCalendarsAvailable({
              accountId: account.accountId
            })
            return [
              account.accountId,
              { calendars: response.calendars ?? [], error: null }
            ] as const
          } catch (error) {
            return [
              account.accountId,
              {
                calendars: [] as AvailableCalendar[],
                error: messageFromAvailableError(error)
              }
            ] as const
          }
        })
      )
      return Object.fromEntries(entries)
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  )

  const { data: syncedData, isLoading: isSyncedLoading } = useGetApiCalendars()

  const syncedCalendars = useMemo(
    () => syncedData?.calendars ?? [],
    [syncedData?.calendars]
  )

  const accountGroups = useMemo((): CalendarAccountGroup[] => {
    return googleAccounts.map((account, index) => {
      const label = account.email?.trim() || `Google account ${index + 1}`
      const available = availableByAccount?.[account.accountId]
      const accountSynced = syncedCalendars.filter(
        (calendar) => calendar.providerAccountId === account.accountId
      )
      return {
        accountId: account.accountId,
        label,
        provider: 'google',
        calendars: buildRowsForAccount(available?.calendars ?? [], accountSynced),
        error: available?.error ?? null
      }
    })
  }, [googleAccounts, availableByAccount, syncedCalendars])

  const refresh = useCallback(async () => {
    await Promise.all([
      mutate(getGetApiOauthGoogleAccountsKey()),
      ...googleAccounts.flatMap((account) => [
        mutate(getGetApiOauthGoogleStatusKey({ accountId: account.accountId })),
        mutate(getGetApiCalendarsAvailableKey({ accountId: account.accountId }))
      ]),
      mutate(['available-calendars-by-account', accountIdsKey]),
      mutate(getGetApiCalendarsKey()),
      mutate(getGetApiEventsKey())
    ])
  }, [mutate, googleAccounts, accountIdsKey])

  const addCalendar = useCallback(
    async (providerAccountId: string, providerCalendarId: string, name: string) => {
      await postApiCalendars({
        providerAccountId,
        providerCalendarId,
        name
      })
      await refresh()
    },
    [refresh]
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
    isGoogleConnected: googleAccounts.length > 0,
    isLoading: isAccountsLoading || isAvailableLoading || isSyncedLoading,
    googleAccounts,
    accountGroups,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar,
    refresh
  }
}
