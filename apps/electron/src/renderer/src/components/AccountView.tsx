import React, { useCallback, useMemo, useState, useEffect } from 'react'
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
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { useAuth } from '../hooks/useAuth'
import { useCalendarSettings } from '../hooks/useCalendarSettings'
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

function CalendarColorDot({ color }: { color?: string | null }): React.JSX.Element {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? '#6366f1' }}
    />
  )
}

export function AccountView(): React.JSX.Element {
  const { user, signOut } = useAuth()
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationPermissionStatus>('not-determined')
  const [isRequesting, setIsRequesting] = useState(false)
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false)
  const [linkStatus, setLinkStatus] = useState<'success' | 'error' | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>()
  const [addingCalendarId, setAddingCalendarId] = useState<string | null>(null)
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null)
  const [removingCalendarId, setRemovingCalendarId] = useState<string | null>(null)

  const {
    isLoading: isCalendarLoading,
    hasCalendarScope,
    availableError,
    googleAccounts,
    availableCalendars,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar,
    refresh
  } = useCalendarSettings(selectedAccountId)

  const effectiveAccountId = selectedAccountId ?? googleAccounts[0]?.accountId

  const accountOptions = useMemo(
    () =>
      googleAccounts.map((account, index) => ({
        id: account.accountId,
        label: account.email ? account.email : `Account ${index + 1}`
      })),
    [googleAccounts]
  )

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>()
    accountOptions.forEach((o) => map.set(o.id, o.label))
    return map
  }, [accountOptions])

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

  const handleAddCalendar = useCallback(
    async (providerCalendarId: string, name: string, providerAccountId: string) => {
      const key = `${providerAccountId}:${providerCalendarId}`
      setAddingCalendarId(key)
      try {
        await addCalendar(providerCalendarId, name)
      } catch (error) {
        console.error('Failed to add calendar:', error)
      } finally {
        setAddingCalendarId(null)
      }
    },
    [addCalendar]
  )

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

  const handleRemoveCalendar = useCallback(
    async (calendarId: string) => {
      setRemovingCalendarId(calendarId)
      try {
        await removeCalendar(calendarId)
      } catch (error) {
        console.error('Failed to remove calendar:', error)
      } finally {
        setRemovingCalendarId(null)
      }
    },
    [removeCalendar]
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

        {/* Google Accounts — collapsible */}
        <CollapsibleSection
          title="Google Accounts"
          icon={<Link className="h-5 w-5 text-muted-foreground" />}
          defaultOpen
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Link Google accounts to import calendars. Signing in with Google is not enough —
              add calendars below after linking.
            </p>
            <div className="space-y-2">
              {isCalendarLoading && googleAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading linked accounts...</p>
              ) : googleAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No Google accounts linked yet.</p>
              ) : (
                <div className="space-y-1">
                  {googleAccounts.map((account, index) => (
                    <div key={account.id} className="text-xs text-muted-foreground">
                      {account.email
                        ? account.email
                        : `Account ${index + 1} • ${account.accountId.slice(-6)}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" onClick={handleLinkGoogleAccount} disabled={isLinkingGoogle}>
              {isLinkingGoogle ? 'Linking...' : 'Link Google Account'}
            </Button>
            {linkStatus === 'success' && (
              <p className="text-xs text-success">
                Account linked. Add calendars below to import events.
              </p>
            )}
            {linkStatus === 'error' && (
              <p className="text-xs text-destructive">Link failed. Please try again.</p>
            )}
          </div>
        </CollapsibleSection>

        {/* Google Calendar status + account picker */}
        <div className="border rounded-lg px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">
                  {googleAccounts.length > 0
                    ? `Connected (${googleAccounts.length} account${googleAccounts.length === 1 ? '' : 's'})`
                    : 'Not connected'}
                </p>
              </div>
            </div>
            {googleAccounts.length > 0 ? (
              <div className="flex items-center gap-1.5 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Link a Google account above</span>
            )}
          </div>

          {googleAccounts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">Linked account</p>
              <div className="flex flex-wrap gap-2">
                {accountOptions.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      effectiveAccountId === account.id
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Available Calendars */}
        {googleAccounts.length > 0 && effectiveAccountId && (
          <CollapsibleSection
            title="Available Calendars"
            icon={<Plus className="h-5 w-5 text-muted-foreground" />}
            defaultOpen={syncedCalendars.length === 0}
          >
            {hasCalendarScope === false && (
              <div className="mb-3 space-y-2">
                <p className="text-sm text-destructive">
                  This Google account is missing Calendar permission. Re-link to grant access.
                </p>
                <Button
                  size="sm"
                  onClick={handleLinkGoogleAccount}
                  disabled={isLinkingGoogle}
                >
                  Re-link Google Account
                </Button>
              </div>
            )}
            {availableError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">{availableError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLinkGoogleAccount}
                  disabled={isLinkingGoogle}
                >
                  Re-link Google Account
                </Button>
              </div>
            ) : isCalendarLoading ? (
              <p className="py-2 text-sm text-muted-foreground">Loading calendars...</p>
            ) : availableCalendars.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No calendars found in your Google account.
              </p>
            ) : (
              <div className="divide-y">
                {availableCalendars.map((cal) => {
                  const key = `${cal.providerAccountId}:${cal.providerCalendarId}`
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="w-16 shrink-0">
                        {cal.isAlreadyAdded ? (
                          <div className="flex items-center gap-1 text-success">
                            <CheckCircle className="h-3 w-3" />
                            <span className="text-xs">Added</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={addingCalendarId === key}
                            onClick={() =>
                              handleAddCalendar(
                                cal.providerCalendarId,
                                cal.name,
                                cal.providerAccountId
                              )
                            }
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add
                          </Button>
                        )}
                      </div>
                      <CalendarColorDot color={cal.color} />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {cal.name}
                        {cal.isPrimary ? (
                          <span className="text-xs font-normal text-muted-foreground">
                            {' '}
                            (Primary)
                          </span>
                        ) : null}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Synced Calendars */}
        {googleAccounts.length > 0 &&
          effectiveAccountId &&
          syncedCalendars.length > 0 && (
            <CollapsibleSection
              title="Synced Calendars"
              icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />}
              defaultOpen
            >
              <div className="divide-y">
                {syncedCalendars.map((cal) => {
                  const lastSynced = cal.lastSyncedAt
                    ? new Date(cal.lastSyncedAt).toLocaleString()
                    : 'Never'
                  const calAccountLabel =
                    accountLabelById.get(cal.providerAccountId) ?? cal.providerAccountId

                  return (
                    <div
                      key={cal.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <CalendarColorDot color={cal.color} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{cal.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {calAccountLabel} · Last synced: {lastSynced}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Switch
                          checked={cal.isEnabled}
                          onCheckedChange={(enabled) =>
                            void toggleCalendarEnabled(cal.id, enabled)
                          }
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={syncingCalendarId === cal.id}
                          onClick={() => void handleSyncCalendar(cal.id)}
                          title="Sync now"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              syncingCalendarId === cal.id ? 'animate-spin' : ''
                            }`}
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={removingCalendarId === cal.id}
                          onClick={() => void handleRemoveCalendar(cal.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

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
