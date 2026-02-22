import { useState, useCallback, useMemo } from 'react';
import { View, Alert, ActivityIndicator, Pressable } from 'react-native';
import {
  LogOut, User, ChevronDown, ChevronRight, Link,
  CalendarDays, Plus, RefreshCw, Trash2, CheckCircle,
  Moon, Sun,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Constants from 'expo-constants';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useCalendarSettings } from '@/hooks/useCalendarSettings';
import { linkGoogleAccount } from '@/lib/oauth';

// ---------------------------------------------------------------------------
// Collapsible Section — matches Electron's CollapsibleSection pattern
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className="border border-border rounded-lg overflow-hidden">
      <Pressable
        onPress={() => setOpen(!open)}
        className="flex-row items-center justify-between px-5 py-4"
      >
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className="text-sm font-medium">{title}</Text>
        </View>
        {open ? (
          <ChevronDown size={16} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground" />
        )}
      </Pressable>
      {open && <View className="px-5 pb-5">{children}</View>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Calendar color dot
// ---------------------------------------------------------------------------

function CalendarColorDot({ color }: { color?: string | null }) {
  return (
    <View
      className="w-3 h-3 rounded-full"
      style={{ backgroundColor: color ?? '#6366f1' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SettingsContent() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { user, signOut } = useAuth();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const isDarkMode = colorScheme === 'dark';

  // Google Accounts & Calendar state
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const [isLinking, setIsLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'success' | 'error' | null>(null);
  const [addingCalendarId, setAddingCalendarId] = useState<string | null>(null);
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null);
  const [removingCalendarId, setRemovingCalendarId] = useState<string | null>(null);

  const {
    isLoading: isCalendarLoading,
    googleAccounts,
    availableCalendars,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar,
    refresh,
  } = useCalendarSettings(selectedAccountId);

  // Derive effective selected account for UI highlighting
  const effectiveAccountId = selectedAccountId ?? googleAccounts[0]?.accountId;

  const accountOptions = useMemo(
    () =>
      googleAccounts.map((account, index) => ({
        id: account.accountId,
        label: account.email
          ? account.email
          : `Account ${index + 1}`,
      })),
    [googleAccounts]
  );

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    accountOptions.forEach((o) => map.set(o.id, o.label));
    return map;
  }, [accountOptions]);

  // Handlers
  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut]);

  const handleLinkGoogle = useCallback(async () => {
    setLinkStatus(null);
    setIsLinking(true);
    try {
      await linkGoogleAccount();
      setLinkStatus('success');
      await refresh();
    } catch {
      setLinkStatus('error');
    } finally {
      setIsLinking(false);
    }
  }, [refresh]);

  const handleAddCalendar = useCallback(
    async (providerCalendarId: string, name: string, providerAccountId: string) => {
      const key = `${providerAccountId}:${providerCalendarId}`;
      setAddingCalendarId(key);
      try {
        await addCalendar(providerCalendarId, name);
      } catch {
        Alert.alert('Error', 'Failed to add calendar');
      } finally {
        setAddingCalendarId(null);
      }
    },
    [addCalendar]
  );

  const handleSyncCalendar = useCallback(
    async (calendarId: string) => {
      setSyncingCalendarId(calendarId);
      try {
        await syncCalendar(calendarId);
      } catch {
        Alert.alert('Error', 'Failed to sync calendar');
      } finally {
        setSyncingCalendarId(null);
      }
    },
    [syncCalendar]
  );

  const handleRemoveCalendar = useCallback(
    async (calendarId: string, name: string) => {
      setRemovingCalendarId(calendarId);
      try {
        await removeCalendar(calendarId);
      } catch {
        Alert.alert('Error', 'Failed to remove calendar');
      } finally {
        setRemovingCalendarId(null);
      }
    },
    [removeCalendar]
  );

  const handleToggleEnabled = useCallback(
    async (calendarId: string, enabled: boolean) => {
      try {
        await toggleCalendarEnabled(calendarId, enabled);
      } catch {
        Alert.alert('Error', 'Failed to toggle calendar');
      }
    },
    [toggleCalendarEnabled]
  );

  return (
    <View className="gap-6">
      {/* Page Header */}
      <View>
        <Text className="text-2xl font-semibold">Account</Text>
        <Text className="mt-1 text-muted-foreground">
          Manage your account and preferences.
        </Text>
      </View>

      {/* Profile */}
      {user && (
        <View className="border border-border rounded-lg px-5 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <User size={20} className="text-muted-foreground" />
              <View className="flex-1">
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {user.name}
                </Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
            <Button variant="ghost" size="sm" onPress={handleSignOut}>
              <View className="flex-row items-center gap-2">
                <LogOut size={16} className="text-muted-foreground" />
                <Text className="text-sm">Sign Out</Text>
              </View>
            </Button>
          </View>
        </View>
      )}

      {/* Appearance */}
      <View className="border border-border rounded-lg px-5 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            {isDarkMode ? (
              <Moon size={20} className="text-muted-foreground" />
            ) : (
              <Sun size={20} className="text-muted-foreground" />
            )}
            <View>
              <Text className="text-sm font-medium">Appearance</Text>
              <Text className="text-xs text-muted-foreground">
                {isDarkMode ? 'Dark mode enabled' : 'Light mode enabled'}
              </Text>
            </View>
          </View>
          <Switch checked={isDarkMode} onCheckedChange={toggleColorScheme} />
        </View>
      </View>

      {/* Google Accounts — collapsible */}
      <CollapsibleSection
        title="Google Accounts"
        icon={<Link size={20} className="text-muted-foreground" />}
      >
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">
            Link Google accounts to import calendars.
          </Text>
          <View className="gap-1">
            {isCalendarLoading ? (
              <Text className="text-xs text-muted-foreground">
                Loading linked accounts...
              </Text>
            ) : googleAccounts.length === 0 ? (
              <Text className="text-xs text-muted-foreground">
                No Google accounts linked yet.
              </Text>
            ) : (
              googleAccounts.map((account, index) => (
                <Text key={account.id} className="text-xs text-muted-foreground">
                  {account.email
                    ? account.email
                    : `Account ${index + 1} \u2022 ${account.accountId.slice(-6)}`}
                </Text>
              ))
            )}
          </View>
          <Button size="sm" onPress={handleLinkGoogle} disabled={isLinking}>
            <View className="flex-row items-center gap-2">
              {isLinking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-sm text-primary-foreground">
                  Link Google Account
                </Text>
              )}
            </View>
          </Button>
          {linkStatus === 'success' && (
            <Text className="text-xs text-green-700">
              Account linked successfully.
            </Text>
          )}
          {linkStatus === 'error' && (
            <Text className="text-xs text-destructive">
              Link failed. Please try again.
            </Text>
          )}
        </View>
      </CollapsibleSection>

      {/* Google Calendar Connection Status */}
      <View className="border border-border rounded-lg px-5 py-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            <CalendarDays size={20} className="text-muted-foreground" />
            <View className="flex-1">
              <Text className="text-sm font-medium">Google Calendar</Text>
              <Text className="text-xs text-muted-foreground">
                {isCalendarLoading
                  ? 'Checking connection...'
                  : googleAccounts.length > 0
                    ? `Connected (${googleAccounts.length} account${googleAccounts.length === 1 ? '' : 's'})`
                    : 'Not connected'}
              </Text>
            </View>
          </View>
          {googleAccounts.length > 0 ? (
            <View className="flex-row items-center gap-1">
              <CheckCircle size={16} color="#15803d" />
              <Text className="text-sm text-green-700">Connected</Text>
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">
              Link a Google account above
            </Text>
          )}
        </View>

        {/* Account selector */}
        {googleAccounts.length > 0 && (
          <View className="mt-4 gap-2">
            <Text className="text-sm text-muted-foreground">Linked account</Text>
            <View className="flex-row flex-wrap gap-2">
              {accountOptions.map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => setSelectedAccountId(account.id)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    effectiveAccountId === account.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      effectiveAccountId === account.id ? 'font-medium' : ''
                    }`}
                    numberOfLines={1}
                  >
                    {account.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Available Calendars — collapsible */}
      {googleAccounts.length > 0 && effectiveAccountId && (
        <CollapsibleSection
          title="Available Calendars"
          icon={<Plus size={20} className="text-muted-foreground" />}
          defaultOpen={syncedCalendars.length === 0}
        >
          {isCalendarLoading ? (
            <Text className="text-sm text-muted-foreground py-2">
              Loading calendars...
            </Text>
          ) : availableCalendars.length === 0 ? (
            <Text className="text-sm text-muted-foreground py-2">
              No calendars found in your Google account.
            </Text>
          ) : (
            <View>
              {availableCalendars.map((cal) => {
                const key = `${cal.providerAccountId}:${cal.providerCalendarId}`;
                return (
                  <View
                    key={key}
                    className="flex-row items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0"
                  >
                    {/* Action on left */}
                    <View className="w-16">
                      {cal.isAlreadyAdded ? (
                        <View className="flex-row items-center gap-1">
                          <CheckCircle size={12} color="#15803d" />
                          <Text className="text-xs text-green-700">Added</Text>
                        </View>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() =>
                            handleAddCalendar(
                              cal.providerCalendarId,
                              cal.name,
                              cal.providerAccountId
                            )
                          }
                          disabled={addingCalendarId === key}
                        >
                          <View className="flex-row items-center gap-1">
                            <Plus size={12} className="text-foreground" />
                            <Text className="text-xs">Add</Text>
                          </View>
                        </Button>
                      )}
                    </View>
                    {/* Calendar info */}
                    <CalendarColorDot color={cal.color} />
                    <View className="flex-1">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {cal.name}
                        {cal.isPrimary && (
                          <Text className="text-xs text-muted-foreground">
                            {' '}
                            (Primary)
                          </Text>
                        )}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </CollapsibleSection>
      )}

      {/* Synced Calendars — collapsible */}
      {googleAccounts.length > 0 && effectiveAccountId && syncedCalendars.length > 0 && (
        <CollapsibleSection
          title="Synced Calendars"
          icon={<CalendarDays size={20} className="text-muted-foreground" />}
          defaultOpen
        >
          <View>
            {syncedCalendars.map((cal) => {
              const lastSynced = cal.lastSyncedAt
                ? new Date(cal.lastSyncedAt).toLocaleString()
                : 'Never';
              const calAccountLabel =
                accountLabelById.get(cal.providerAccountId) ??
                cal.providerAccountId;

              return (
                <View
                  key={cal.id}
                  className="flex-row items-center justify-between py-3 border-b border-border/50 last:border-b-0"
                >
                  <View className="flex-row items-center gap-3 flex-1 min-w-0">
                    <CalendarColorDot color={cal.color} />
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-medium" numberOfLines={1}>
                        {cal.name}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        Last synced: {lastSynced}
                      </Text>
                      {googleAccounts.length > 1 && (
                        <Text className="text-xs text-muted-foreground">
                          Account: {calAccountLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Switch
                      checked={cal.isEnabled}
                      onCheckedChange={(enabled) =>
                        handleToggleEnabled(cal.id, enabled)
                      }
                    />
                    <Pressable
                      onPress={() => handleSyncCalendar(cal.id)}
                      disabled={syncingCalendarId === cal.id}
                      className="p-1.5"
                    >
                      {syncingCalendarId === cal.id ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <RefreshCw size={14} className="text-muted-foreground" />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemoveCalendar(cal.id, cal.name)}
                      disabled={removingCalendarId === cal.id}
                      className="p-1.5"
                    >
                      <Trash2 size={14} className="text-muted-foreground" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </CollapsibleSection>
      )}

      {/* About — minimal footer */}
      <View className="pt-2 items-center">
        <Text className="text-sm text-muted-foreground">
          Comori v{appVersion} — Your cozy focus companion
        </Text>
      </View>
    </View>
  );
}
