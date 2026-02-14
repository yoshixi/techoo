import React, { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Keyboard, Bell, CheckCircle, XCircle, AlertCircle, LogOut, User, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

type NotificationPermissionStatus = 'granted' | 'denied' | 'not-determined'

const keyboardShortcuts = [
  { keys: ['⌘', 'N'], description: 'Create a new task' },
  { keys: ['⌘', 'E'], description: 'Toggle sidebar' },
  { keys: ['Space'], description: 'Toggle timer for selected task' },
  { keys: ['Tab'], description: 'Navigate to next task' },
  { keys: ['Shift', 'Tab'], description: 'Navigate to previous task' }
]

function NotificationStatusBadge({ status }: { status: NotificationPermissionStatus }): React.JSX.Element {
  switch (status) {
    case 'granted':
      return (
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Enabled</span>
        </div>
      )
    case 'denied':
      return (
        <div className="flex items-center gap-1.5 text-red-600">
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
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-6 pb-5 pt-0">{children}</div>}
    </div>
  )
}

export function AccountView(): React.JSX.Element {
  const { user, signOut } = useAuth()
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermissionStatus>('not-determined')
  const [isRequesting, setIsRequesting] = useState(false)

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

  return (
    <div className="p-8 overflow-auto flex-1 min-h-0">
      <h2 className="text-2xl font-semibold tracking-tight">Account</h2>
      <p className="mt-2 text-muted-foreground">
        Manage your account and preferences.
      </p>

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
                {notificationStatus === 'denied' ? 'Open System Settings' : 'Manage in System Settings'}
              </Button>
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
          Shuchu — Focus-driven task management
        </div>
      </div>
    </div>
  )
}
