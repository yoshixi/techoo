import { useState, useCallback } from 'react';
import { View, Alert, ActivityIndicator, Pressable } from 'react-native';
import {
  LogOut, User, ChevronDown, ChevronRight, Link,
  CalendarDays, RefreshCw, Moon, Sun,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Constants from 'expo-constants';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import {
  useCalendarSettings,
  type CalendarSettingsRow,
} from '@/hooks/useCalendarSettings';
import { useCalendarColors } from '@/hooks/useCalendarColors';
import { useDailyHourWindow } from '@/hooks/useDailyHourWindow';
import { CalendarColorPicker } from '@/components/calendar/CalendarColorPicker';
import { linkGoogleAccount } from '@/lib/oauth';
import { showApiError } from '@/lib/showApiError';

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
// Main Component
// ---------------------------------------------------------------------------

export function SettingsContent() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { user, signOut } = useAuth();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const isDarkMode = colorScheme === 'dark';
  const { wakeHour, bedHour, setWakeHour, setBedHour } = useDailyHourWindow();

  const incrementWakeHour = useCallback(() => {
    setWakeHour(Math.min(wakeHour + 1, bedHour - 1));
  }, [wakeHour, bedHour, setWakeHour]);

  const decrementWakeHour = useCallback(() => {
    setWakeHour(Math.max(wakeHour - 1, 0));
  }, [wakeHour, setWakeHour]);

  const incrementBedHour = useCallback(() => {
    setBedHour(Math.min(bedHour + 1, 23));
  }, [bedHour, setBedHour]);

  const decrementBedHour = useCallback(() => {
    setBedHour(Math.max(bedHour - 1, wakeHour + 1));
  }, [bedHour, wakeHour, setBedHour]);

  const hourLabel = useCallback((h: number) => `${h.toString().padStart(2, '0')}:00`, []);

  const [isLinking, setIsLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState<'success' | 'error' | null>(null);
  const [togglingCalendarKey, setTogglingCalendarKey] = useState<string | null>(null);
  const [syncingCalendarId, setSyncingCalendarId] = useState<string | null>(null);

  const {
    isLoading: isCalendarLoading,
    googleAccounts,
    accountGroups,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    syncCalendar,
    refresh,
  } = useCalendarSettings();
  const { calendarColorMap, setCalendarColor } = useCalendarColors(syncedCalendars);

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
    } catch (err) {
      showApiError(err, 'Link failed');
    } finally {
      setIsLinking(false);
    }
  }, [refresh]);

  const handleSyncCalendar = useCallback(
    async (calendarId: string) => {
      setSyncingCalendarId(calendarId);
      try {
        await syncCalendar(calendarId);
      } catch {
        /* API failure reported from customInstance */
      } finally {
        setSyncingCalendarId(null);
      }
    },
    [syncCalendar]
  );

  const handleToggleCalendar = useCallback(
    async (row: CalendarSettingsRow, enabled: boolean) => {
      setTogglingCalendarKey(row.key);
      try {
        if (enabled) {
          if (row.synced) {
            await syncCalendar(row.synced.id);
          } else {
            await addCalendar(
              row.providerAccountId,
              row.providerCalendarId,
              row.name
            );
          }
        } else if (row.synced) {
          await removeCalendar(row.synced.id);
        }
      } catch {
        /* API failure reported from customInstance */
      } finally {
        setTogglingCalendarKey(null);
      }
    },
    [addCalendar, removeCalendar, syncCalendar]
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

      {/* Daily schedule hours */}
      <View className="border border-border rounded-lg px-5 py-4">
        <View className="mb-3">
          <Text className="text-sm font-medium">Daily schedule hours</Text>
          <Text className="text-xs text-muted-foreground">
            Controls which hours appear on the ToDos schedule.
          </Text>
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Wake-up hour</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={decrementWakeHour}
              className="h-8 w-8 items-center justify-center rounded-full border border-border"
            >
              <Text className="text-base">-</Text>
            </Pressable>
            <Text className="w-16 text-center text-sm font-medium">{hourLabel(wakeHour)}</Text>
            <Pressable
              onPress={incrementWakeHour}
              className="h-8 w-8 items-center justify-center rounded-full border border-border"
            >
              <Text className="text-base">+</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-muted-foreground">Bedtime hour</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={decrementBedHour}
              className="h-8 w-8 items-center justify-center rounded-full border border-border"
            >
              <Text className="text-base">-</Text>
            </Pressable>
            <Text className="w-16 text-center text-sm font-medium">{hourLabel(bedHour)}</Text>
            <Pressable
              onPress={incrementBedHour}
              className="h-8 w-8 items-center justify-center rounded-full border border-border"
            >
              <Text className="text-base">+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Calendars — accounts as groups, calendars nested underneath */}
      <CollapsibleSection
        title="Calendars"
        icon={<CalendarDays size={20} className="text-muted-foreground" />}
        defaultOpen
      >
        <View className="gap-4">
          <Text className="text-xs text-muted-foreground">
            Turn on calendars under each account to sync events.
          </Text>

          <Button size="sm" onPress={handleLinkGoogle} disabled={isLinking}>
            <View className="flex-row items-center gap-2">
              {isLinking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Link size={14} className="text-primary-foreground" />
                  <Text className="text-sm text-primary-foreground">
                    {googleAccounts.length > 0
                      ? 'Link another Google account'
                      : 'Link Google Account'}
                  </Text>
                </>
              )}
            </View>
          </Button>
          {linkStatus === 'success' && (
            <Text className="text-xs text-green-700">
              Account linked. Turn on calendars below to sync events.
            </Text>
          )}
          {linkStatus === 'error' && (
            <Text className="text-xs text-destructive">
              Link failed. Please try again.
            </Text>
          )}

          {isCalendarLoading && accountGroups.length === 0 ? (
            <Text className="text-sm text-muted-foreground">Loading calendars...</Text>
          ) : accountGroups.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              No calendar accounts linked yet.
            </Text>
          ) : (
            <View className="gap-5">
              {accountGroups.map((group) => (
                <View key={group.accountId} className="gap-2">
                  <Text className="text-sm font-medium" numberOfLines={1}>
                    {group.label}
                  </Text>
                  {group.error ? (
                    <View className="gap-2 pl-3">
                      <Text className="text-sm text-destructive">{group.error}</Text>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={handleLinkGoogle}
                        disabled={isLinking}
                      >
                        <Text className="text-sm">Re-link Google Account</Text>
                      </Button>
                    </View>
                  ) : group.calendars.length === 0 ? (
                    <Text className="pl-3 text-sm text-muted-foreground">
                      {isCalendarLoading
                        ? 'Loading calendars...'
                        : 'No calendars found for this account.'}
                    </Text>
                  ) : (
                    <View className="pl-3 border-l border-border">
                      {group.calendars.map((row) => {
                        const busy = togglingCalendarKey === row.key;
                        const synced = row.synced;
                        const lastSynced = synced?.lastSyncedAt
                          ? new Date(synced.lastSyncedAt).toLocaleString()
                          : null;
                        const swatchColor = synced
                          ? (calendarColorMap[synced.id] ?? row.googleColor ?? '#6366f1')
                          : (row.googleColor ?? '#6366f1');

                        return (
                          <View
                            key={row.key}
                            className="gap-2 py-3 border-b border-border/50 last:border-b-0"
                          >
                            <View className="flex-row items-center justify-between gap-3">
                              <View className="flex-row items-center gap-3 flex-1 min-w-0">
                                <View
                                  className="h-3 w-3 rounded-full border border-border"
                                  style={{ backgroundColor: swatchColor }}
                                />
                                <View className="flex-1 min-w-0">
                                  <Text className="text-sm font-medium" numberOfLines={1}>
                                    {row.name}
                                    {row.isPrimary ? (
                                      <Text className="text-xs text-muted-foreground">
                                        {' '}
                                        (Primary)
                                      </Text>
                                    ) : null}
                                  </Text>
                                  <Text className="text-xs text-muted-foreground">
                                    {row.isOn && lastSynced
                                      ? `Last synced: ${lastSynced}`
                                      : 'Not syncing'}
                                  </Text>
                                </View>
                              </View>
                              <View className="flex-row items-center gap-2">
                                {busy ? <ActivityIndicator size="small" /> : null}
                                {synced ? (
                                  <Pressable
                                    onPress={() => handleSyncCalendar(synced.id)}
                                    disabled={syncingCalendarId === synced.id || busy}
                                    className="p-1.5"
                                    accessibilityLabel="Sync now"
                                  >
                                    {syncingCalendarId === synced.id ? (
                                      <ActivityIndicator size="small" />
                                    ) : (
                                      <RefreshCw size={14} className="text-muted-foreground" />
                                    )}
                                  </Pressable>
                                ) : null}
                                <Switch
                                  checked={row.isOn}
                                  disabled={busy}
                                  onCheckedChange={(enabled) =>
                                    void handleToggleCalendar(row, enabled)
                                  }
                                />
                              </View>
                            </View>
                            {synced ? (
                              <CalendarColorPicker
                                color={calendarColorMap[synced.id]}
                                onSelect={(nextColor) =>
                                  setCalendarColor(String(synced.id), nextColor)
                                }
                              />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </CollapsibleSection>

      {/* About — minimal footer */}
      <View className="pt-2 items-center">
        <Text className="text-sm text-muted-foreground">
          Techoo v{appVersion} — Your cozy focus companion
        </Text>
      </View>
    </View>
  );
}
