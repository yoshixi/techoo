import React, { useCallback, useState, useEffect } from 'react'
import {
  Keyboard,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Link,
  CalendarDays,
  RefreshCw,
  Loader2
} from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { useAuth } from '../hooks/useAuth'
import {
  useCalendarSettings,
  type CalendarSettingsRow
} from '../hooks/useCalendarSettings'
import { useCalendarColors } from '../hooks/useCalendarColors'
import { CalendarColorPicker } from './CalendarColorPicker'
import { getSessionToken } from '../lib/auth'

type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

const keyboardShortcuts = [
  { keys: ['⌘', 'N'], description: 'Create a new task' },
  { keys: ['⌘', 'E'], description: 'Toggle sidebar' },
  { keys: ['Space'], description: 'Toggle timer for selected task' },
  { keys: ['Tab'], description: 'Navigate to next task' },
  { keys: ['Shift', 'Tab'], description: 'Navigate to previous task' }
]

function NotificationStatusBadge({
  status
}: {
  status: NotificationPermissionStatus
}): React.JSX.Element {
  switch (status) {
    case 'granted':
      return (
        <div className="flex items-center gap-1.5 text-success">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Enabled</span>
        </div>
      )
    case 'denied':
      return (
        <div className="flex items-center gap-1.5 text-destructive">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Disabled</span>
        </div>
      )
    case 'not-determined':
      return (
        <div className="flex items-center gap-1.5 text-yellow-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Not Set</span>
        </div>
      )
  }
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-6 pb-5 pt-0">{children}</div>}
    </div>
  )
}

export function AccountView(): React.JSX.Element {
  const { user, signOut } = useAuth()
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationPermissionStatus>('not-determined')
  const [isRequesting, setIsRequesting] = useState(false)
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)
  const [linkStatus, setLinkStatus] = useState<'success' | 'error' | null>(null)
  const [togglingCalendarKey, setTogglingCalendarKey] = useState<string | null>(null)
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null)

  const {
    isLoading: isCalendarLoading,
    googleAccounts,
    accountGroups,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    syncCalendar,
    refresh
  } = useCalendarSettings()
  const { calendarColorMap, setCalendarColor } = useCalendarColors(syncedCalendars)

  useEffect(() => {
    window.api.getNotificationPermission().then(setNotificationStatus)
  }, [])

  const handleRequestPermission = async (): Promise<void> => {
    setIsRequesting(true)
    try {
      const status = await window.api.requestNotificationPermission()
      setNotificationStatus(status)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleOpenSettings = (): void => {
    window.api.openNotificationSettings()
  }

  const handleSignOut = async (): Promise<void> => {
    await signOut()
    window.location.reload()
  }

  const handleLinkGoogleAccount = useCallback(async (): Promise<void> => {
    setLinkStatus(null)
    const sessionToken = await getSessionToken()
    if (!sessionToken) {
      setLinkStatus('error')
      return
    }

    setIsLinkingGoogle(true)
    try {
      const linked = await window.api.linkSocialAccount('google', sessionToken)
      setLinkStatus(linked ? 'success' : 'error')
      if (linked) {
        await refresh()
      }
    } catch (error) {
      console.error('Failed to link Google account:', error)
      setLinkStatus('error')
    } finally {
      setIsLinkingGoogle(false)
    }
  }, [refresh])

  const handleSyncCalendar = useCallback(
    async (calendarId: string) => {
      setSyncingCalendarId(calendarId)
      try {
        await syncCalendar(calendarId)
      } catch (error) {
        console.error('Failed to sync calendar:', error)
      } finally {
        setSyncingCalendarId(null)
      }
    },
    [syncCalendar]
  )

  const handleToggleCalendar = useCallback(
    async (row: CalendarSettingsRow, enabled: boolean) => {
      setTogglingCalendarKey(row.key)
      try {
        if (enabled) {
          if (row.synced) {
            await syncCalendar(row.synced.id)
          } else {
            await addCalendar(row.providerAccountId, row.providerCalendarId, row.name)
          }
        } else if (row.synced) {
          await removeCalendar(row.synced.id)
        }
      } catch (error) {
        console.error('Failed to toggle calendar:', error)
      } finally {
        setTogglingCalendarKey(null)
      }
    },
    [addCalendar, removeCalendar, syncCalendar]
  )

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <h2 className="text-2xl font-semibold tracking-tight">Your Space</h2>
      <p className="mt-2 text-muted-foreground">Manage your account and preferences.</p>

      <div className="mt-8 space-y-6">
        {/* Profile */}
        <div className="border rounded-lg px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <User className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.name ?? '-'}</p>
                <p className="text-sm text-muted-foreground truncate">{user?.email ?? '-'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Notifications — collapsible */}
        <CollapsibleSection
          title="Notifications"
          icon={<Bell className="h-5 w-5 text-muted-foreground" />}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {notificationStatus === 'granted'
                  ? 'You will receive task reminders'
                  : notificationStatus === 'denied'
                    ? 'Enable in system settings'
                    : 'Allow notifications for reminders'}
              </p>
              <NotificationStatusBadge status={notificationStatus} />
            </div>
            {notificationStatus === 'not-determined' && (
              <Button size="sm" onClick={handleRequestPermission} disabled={isRequesting}>
                {isRequesting ? 'Requesting...' : 'Enable Notifications'}
              </Button>
            )}
            {notificationStatus !== 'not-determined' && (
              <Button size="sm" variant="outline" onClick={handleOpenSettings}>
                {notificationStatus === 'denied'
                  ? 'Open System Settings'
                  : 'Manage in System Settings'}
              </Button>
            )}
          </div>
        </CollapsibleSection>

        {/* Calendars — accounts as groups, calendars nested underneath */}
        <CollapsibleSection
          title="Calendars"
          icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />}
          defaultOpen
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Turn on calendars under each account to sync events.
            </p>

            <Button size="sm" onClick={handleLinkGoogleAccount} disabled={isLinkingGoogle}>
              <Link className="mr-1.5 h-3.5 w-3.5" />
              {isLinkingGoogle
                ? 'Linking...'
                : googleAccounts.length > 0
                  ? 'Link another Google account'
                  : 'Link Google Account'}
            </Button>
            {linkStatus === 'success' && (
              <p className="text-xs text-success">
                Account linked. Turn on calendars below to sync events.
              </p>
            )}
            {linkStatus === 'error' && (
              <p className="text-xs text-destructive">Link failed. Please try again.</p>
            )}

            {isCalendarLoading && accountGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading calendars...</p>
            ) : accountGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calendar accounts linked yet.</p>
            ) : (
              <div className="space-y-5">
                {accountGroups.map((group) => (
                  <div key={group.accountId} className="space-y-2">
                    <p className="truncate text-sm font-medium">{group.label}</p>
                    {group.error ? (
                      <div className="space-y-2 border-l border-border pl-3">
                        <p className="text-sm text-destructive">{group.error}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleLinkGoogleAccount}
                          disabled={isLinkingGoogle}
                        >
                          Re-link Google Account
                        </Button>
                      </div>
                    ) : group.calendars.length === 0 ? (
                      <p className="border-l border-border pl-3 text-sm text-muted-foreground">
                        {isCalendarLoading
                          ? 'Loading calendars...'
                          : 'No calendars found for this account.'}
                      </p>
                    ) : (
                      <div className="divide-y border-l border-border pl-3">
                        {group.calendars.map((row) => {
                          const busy = togglingCalendarKey === row.key
                          const synced = row.synced
                          const lastSynced = synced?.lastSyncedAt
                            ? new Date(synced.lastSyncedAt).toLocaleString()
                            : null
                          const swatchColor = synced
                            ? (calendarColorMap[synced.id] ?? row.googleColor ?? '#6366f1')
                            : (row.googleColor ?? '#6366f1')

                          return (
                            <div key={row.key} className="space-y-2 py-3 first:pt-0 last:pb-0">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <span
                                    className="h-3 w-3 shrink-0 rounded-full border border-border"
                                    style={{ backgroundColor: swatchColor }}
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                      {row.name}
                                      {row.isPrimary ? (
                                        <span className="text-xs font-normal text-muted-foreground">
                                          {' '}
                                          (Primary)
                                        </span>
                                      ) : null}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {row.isOn && lastSynced
                                        ? `Last synced: ${lastSynced}`
                                        : 'Not syncing'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : null}
                                  {synced ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={syncingCalendarId === synced.id || busy}
                                      onClick={() => void handleSyncCalendar(synced.id)}
                                      title="Sync now"
                                    >
                                      <RefreshCw
                                        className={`h-4 w-4 ${
                                          syncingCalendarId === synced.id ? 'animate-spin' : ''
                                        }`}
                                      />
                                    </Button>
                                  ) : null}
                                  <Switch
                                    checked={row.isOn}
                                    disabled={busy}
                                    onCheckedChange={(enabled) =>
                                      void handleToggleCalendar(row, enabled)
                                    }
                                  />
                                </div>
                              </div>
                              {synced ? (
                                <CalendarColorPicker
                                  color={calendarColorMap[synced.id]}
                                  onSelect={(nextColor) =>
                                    setCalendarColor(String(synced.id), nextColor)
                                  }
                                />
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Keyboard Shortcuts — collapsible */}
        <CollapsibleSection
          title="Keyboard Shortcuts"
          icon={<Keyboard className="h-5 w-5 text-muted-foreground" />}
        >
          <div className="space-y-3">
            {keyboardShortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border border-border">
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-muted-foreground text-xs">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* About — minimal footer */}
        <div className="pt-2 text-center text-sm text-muted-foreground">
          Techo — Your digital planner
        </div>
      </div>
    </div>
  )
}
