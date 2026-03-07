import React, { useMemo, useState, useEffect } from 'react'
import {
  CalendarDays,
  CheckCircle,
  Plus,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import {
  useCalendarSettings,
  type AvailableCalendarWithAccount,
  type CalendarWithAccount
} from '../hooks/useCalendarSettings'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'

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
    <div
      className="h-3 w-3 rounded-full shrink-0"
      style={{ backgroundColor: color ?? '#6366f1' }}
    />
  )
}

function AvailableCalendarItem({
  calendar,
  onAdd,
  isAdding,
  accountLabel
}: {
  calendar: AvailableCalendarWithAccount
  onAdd: () => void
  isAdding: boolean
  accountLabel?: string
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
      {/* Action button/badge on left side - always visible */}
      <div className="shrink-0 w-16">
        {calendar.isAlreadyAdded ? (
          <span className="flex items-center gap-1 text-xs text-green-700">
            <CheckCircle className="h-3 w-3" />
            Added
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onAdd}
            disabled={isAdding}
            className="h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>
      {/* Calendar info - truncates when needed */}
      <CalendarColorDot color={calendar.color} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {calendar.name}
          {calendar.isPrimary && (
            <span className="ml-2 text-xs text-muted-foreground">(Primary)</span>
          )}
        </p>
        {accountLabel && (
          <p className="text-xs text-muted-foreground">Account: {accountLabel}</p>
        )}
      </div>
    </div>
  )
}

function SyncedCalendarItem({
  calendar,
  onToggleEnabled,
  onSync,
  onRemove,
  isSyncing,
  isRemoving,
  accountLabel
}: {
  calendar: CalendarWithAccount
  onToggleEnabled: (enabled: boolean) => void
  onSync: () => void
  onRemove: () => void
  isSyncing: boolean
  isRemoving: boolean
  accountLabel?: string
}): React.JSX.Element {
  const lastSynced = calendar.lastSyncedAt
    ? new Date(calendar.lastSyncedAt).toLocaleString()
    : 'Never'

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <CalendarColorDot color={calendar.color} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{calendar.name}</p>
          <p className="text-xs text-muted-foreground">Last synced: {lastSynced}</p>
          {accountLabel && (
            <p className="text-xs text-muted-foreground">Account: {accountLabel}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={calendar.isEnabled}
          onCheckedChange={onToggleEnabled}
          aria-label={calendar.isEnabled ? 'Disable calendar' : 'Enable calendar'}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={onSync}
          disabled={isSyncing}
          title="Sync now"
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          disabled={isRemoving}
          title="Remove calendar"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export function SettingsView(): React.JSX.Element {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const {
    isExplicitlyDisconnected,
    isLoading,
    availableCalendarsError,
    googleAccounts,
    selectedAccountStatus,
    availableCalendars,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar
  } = useCalendarSettings(selectedAccountId ?? undefined)

  const [addingCalendarId, setAddingCalendarId] = useState<string | null>(null)
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null)
  const [removingCalendarId, setRemovingCalendarId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedAccountId && googleAccounts.length > 0) {
      setSelectedAccountId(googleAccounts[0].accountId)
    }
  }, [googleAccounts, selectedAccountId])

  const accountOptions = useMemo(
    () =>
      googleAccounts.map((account, index) => ({
        id: account.accountId,
        label: account.email
          ? account.email
          : `Account ${index + 1} • ${account.accountId.slice(-6)}`
      })),
    [googleAccounts]
  )

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>()
    accountOptions.forEach((option) => {
      map.set(option.id, option.label)
    })
    return map
  }, [accountOptions])

  const isSelectedAccountConnected =
    selectedAccountId ? !isExplicitlyDisconnected : googleAccounts.length > 0

  const handleAddCalendar = async (
    calendar: AvailableCalendarWithAccount
  ): Promise<void> => {
    const key = `${calendar.providerAccountId}:${calendar.providerCalendarId}`
    setAddingCalendarId(key)
    try {
      await addCalendar(calendar.providerCalendarId, calendar.name)
    } catch (error) {
      console.error('Failed to add calendar:', error)
    } finally {
      setAddingCalendarId(null)
    }
  }

  const handleSyncCalendar = async (calendarId: string): Promise<void> => {
    setSyncingCalendarId(calendarId)
    try {
      await syncCalendar(calendarId)
    } catch (error) {
      console.error('Failed to sync calendar:', error)
    } finally {
      setSyncingCalendarId(null)
    }
  }

  const handleRemoveCalendar = async (calendarId: string): Promise<void> => {
    setRemovingCalendarId(calendarId)
    try {
      await removeCalendar(calendarId)
    } catch (error) {
      console.error('Failed to remove calendar:', error)
    } finally {
      setRemovingCalendarId(null)
    }
  }

  const handleToggleEnabled = async (
    calendarId: string,
    enabled: boolean
  ): Promise<void> => {
    try {
      await toggleCalendarEnabled(calendarId, enabled)
    } catch (error) {
      console.error('Failed to toggle calendar:', error)
    }
  }

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
      <p className="mt-2 text-muted-foreground">
        Configure calendar integrations and sync preferences.
      </p>

      <div className="mt-8 space-y-6">
        {/* Google Calendar Connection Status */}
        <div className="border rounded-lg px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Google Calendar</p>
                <p className="text-xs text-muted-foreground">
                  {isLoading
                    ? 'Checking connection...'
                    : googleAccounts.length > 0
                      ? `Connected (${googleAccounts.length} account${googleAccounts.length === 1 ? '' : 's'})`
                      : 'Not connected'}
                </p>
              </div>
            </div>
            {googleAccounts.length > 0 ? (
              <span className="flex items-center gap-1.5 text-green-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                Connected
              </span>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sign in with Google in Account to sync calendars
              </p>
            )}
          </div>
          {googleAccounts.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="text-sm text-muted-foreground">Linked account</div>
              <Select
                value={selectedAccountId ?? undefined}
                onValueChange={(value) => setSelectedAccountId(value)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccountStatus && (
                <span className="text-xs text-muted-foreground">
                  {selectedAccountStatus.connected ? 'Active' : 'Needs reconnect'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Available Calendars - only show when connected */}
        {googleAccounts.length > 0 && selectedAccountId && (
          <CollapsibleSection
            title="Available Calendars"
            icon={<Plus className="h-5 w-5 text-muted-foreground" />}
            defaultOpen={syncedCalendars.length === 0}
          >
            {!isSelectedAccountConnected ? (
              <p className="text-sm text-muted-foreground py-2">
                Selected account needs reconnect before listing calendars.
              </p>
            ) : availableCalendarsError ? (
              <p className="text-sm text-destructive py-2">
                Failed to load available calendars: {availableCalendarsError}
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted-foreground py-2">Loading calendars...</p>
            ) : availableCalendars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No calendars found in your Google account.
              </p>
            ) : (
              <div className="divide-y">
                {availableCalendars.map((calendar) => (
                  <AvailableCalendarItem
                    key={`${calendar.providerAccountId}:${calendar.providerCalendarId}`}
                    calendar={calendar}
                    onAdd={() => handleAddCalendar(calendar)}
                    isAdding={
                      addingCalendarId ===
                      `${calendar.providerAccountId}:${calendar.providerCalendarId}`
                    }
                    accountLabel={
                      accountLabelById.get(calendar.providerAccountId) ??
                      calendar.providerAccountId
                    }
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>
        )}

        {/* Synced Calendars - only show when connected and has calendars */}
        {googleAccounts.length > 0 && selectedAccountId && syncedCalendars.length > 0 && (
          <CollapsibleSection
            title="Synced Calendars"
            icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />}
            defaultOpen
          >
            <div className="divide-y">
              {syncedCalendars.map((calendar) => (
                <SyncedCalendarItem
                  key={calendar.id}
                  calendar={calendar}
                  onToggleEnabled={(enabled) => handleToggleEnabled(calendar.id, enabled)}
                  onSync={() => handleSyncCalendar(calendar.id)}
                  onRemove={() => handleRemoveCalendar(calendar.id)}
                  isSyncing={syncingCalendarId === calendar.id}
                  isRemoving={removingCalendarId === calendar.id}
                  accountLabel={
                    accountLabelById.get(calendar.providerAccountId) ??
                    calendar.providerAccountId
                  }
                />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  )
}
