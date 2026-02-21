import { useState, useCallback } from 'react';
import { View, Alert, Linking, ActivityIndicator, Pressable } from 'react-native';
import {
  Moon, Sun, Server, Info, ExternalLink, LogOut, User,
  Plus, Trash2, RefreshCw, Calendar,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import Constants from 'expo-constants';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useGetApiHealth } from '@/gen/api/endpoints/shuchuAPI.gen';
import { API_BASE_URL } from '@/lib/api/mutator';
import { useAuth } from '@/hooks/useAuth';
import { useCalendarSettings } from '@/hooks/useCalendarSettings';
import { linkGoogleAccount } from '@/lib/oauth';

export function SettingsContent() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const { data: healthData, error: healthError, isLoading } = useGetApiHealth();
  const { user, signOut } = useAuth();

  const isDarkMode = colorScheme === 'dark';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  // Google Accounts & Calendar state
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const {
    googleAccounts,
    availableCalendars,
    syncedCalendars,
    addCalendar,
    removeCalendar,
    toggleCalendarEnabled,
    syncCalendar,
    refresh,
  } = useCalendarSettings(selectedAccountId);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }, [signOut]);

  const handleTestConnection = useCallback(() => {
    if (healthData) {
      Alert.alert('Connection Successful', `API is running: ${healthData.message}`);
    } else if (healthError) {
      Alert.alert('Connection Failed', 'Could not connect to the API server.');
    }
  }, [healthData, healthError]);

  const handleOpenDocs = useCallback(() => {
    Linking.openURL(`${API_BASE_URL}/api/doc`);
  }, []);

  const handleLinkGoogle = useCallback(async () => {
    setIsLinking(true);
    try {
      await linkGoogleAccount();
      await refresh();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to link Google account');
    } finally {
      setIsLinking(false);
    }
  }, [refresh]);

  const handleAddCalendar = useCallback(async (providerCalendarId: string, name: string) => {
    try {
      await addCalendar(providerCalendarId, name);
    } catch (error) {
      Alert.alert('Error', 'Failed to add calendar');
    }
  }, [addCalendar]);

  const handleRemoveCalendar = useCallback(async (calendarId: string, name: string) => {
    Alert.alert('Remove Calendar', `Remove "${name}" from synced calendars?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCalendar(calendarId);
          } catch {
            Alert.alert('Error', 'Failed to remove calendar');
          }
        },
      },
    ]);
  }, [removeCalendar]);

  const handleSyncCalendar = useCallback(async (calendarId: string) => {
    setIsSyncing(calendarId);
    try {
      await syncCalendar(calendarId);
    } catch {
      Alert.alert('Error', 'Failed to sync calendar');
    } finally {
      setIsSyncing(null);
    }
  }, [syncCalendar]);

  // Auto-select first account if none selected
  if (!selectedAccountId && googleAccounts.length > 0) {
    setSelectedAccountId(googleAccounts[0].accountId);
  }

  return (
    <View className="gap-4">
      {/* Account */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <User size={20} className="text-muted-foreground" />
                <View className="flex-1">
                  <Text className="font-medium">{user.name}</Text>
                  <Text className="text-sm text-muted-foreground">{user.email}</Text>
                </View>
              </View>
              <Separator />
              <Button variant="destructive" onPress={handleSignOut}>
                <View className="flex-row items-center gap-2">
                  <LogOut size={16} color="white" />
                  <Text>Sign Out</Text>
                </View>
              </Button>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Google Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Google Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="gap-3">
            {googleAccounts.map((account) => (
              <Pressable
                key={account.id}
                onPress={() => setSelectedAccountId(account.accountId)}
                className={`flex-row items-center gap-3 p-2 rounded ${
                  selectedAccountId === account.accountId ? 'bg-primary/10' : ''
                }`}
              >
                <View
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: selectedAccountId === account.accountId ? '#4285F4' : '#ccc',
                  }}
                />
                <Text className="text-sm flex-1">{account.email || account.accountId}</Text>
              </Pressable>
            ))}
            {googleAccounts.length === 0 && (
              <Text className="text-sm text-muted-foreground">No Google accounts linked</Text>
            )}
            <Button onPress={handleLinkGoogle} variant="outline" disabled={isLinking}>
              <View className="flex-row items-center gap-2">
                {isLinking ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Plus size={16} className="text-foreground" />
                )}
                <Text>Link Google Account</Text>
              </View>
            </Button>
          </View>
        </CardContent>
      </Card>

      {/* Calendars */}
      {googleAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Calendars</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="gap-4">
              {/* Account selector (if multiple) */}
              {googleAccounts.length > 1 && (
                <View className="gap-1">
                  <Text className="text-sm text-muted-foreground">Account</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {googleAccounts.map((account) => (
                      <Pressable
                        key={account.id}
                        onPress={() => setSelectedAccountId(account.accountId)}
                        className={`px-3 py-1 rounded-full border ${
                          selectedAccountId === account.accountId
                            ? 'border-primary bg-primary/10'
                            : 'border-border'
                        }`}
                      >
                        <Text className="text-xs">
                          {account.email || account.accountId}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Synced Calendars */}
              {syncedCalendars.length > 0 && (
                <View className="gap-2">
                  <Text className="text-sm font-medium">Synced Calendars</Text>
                  {syncedCalendars.map((cal) => (
                    <View key={cal.id} className="flex-row items-center gap-2">
                      <View
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cal.color || '#4285F4' }}
                      />
                      <Text className="text-sm flex-1" numberOfLines={1}>
                        {cal.name}
                      </Text>
                      <Switch
                        checked={cal.isEnabled}
                        onCheckedChange={(enabled) =>
                          toggleCalendarEnabled(cal.id, enabled)
                        }
                      />
                      <Pressable
                        onPress={() => handleSyncCalendar(cal.id)}
                        disabled={isSyncing === cal.id}
                        className="p-1"
                      >
                        {isSyncing === cal.id ? (
                          <ActivityIndicator size="small" />
                        ) : (
                          <RefreshCw size={14} className="text-muted-foreground" />
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => handleRemoveCalendar(cal.id, cal.name)}
                        className="p-1"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Available Calendars */}
              {availableCalendars.filter((c) => !c.isAlreadyAdded).length > 0 && (
                <View className="gap-2">
                  <Text className="text-sm font-medium">Available Calendars</Text>
                  {availableCalendars
                    .filter((c) => !c.isAlreadyAdded)
                    .map((cal) => (
                      <View
                        key={cal.providerCalendarId}
                        className="flex-row items-center gap-2"
                      >
                        <View
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cal.color || '#4285F4' }}
                        />
                        <Text className="text-sm flex-1" numberOfLines={1}>
                          {cal.name}
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() =>
                            handleAddCalendar(cal.providerCalendarId, cal.name)
                          }
                        >
                          <View className="flex-row items-center gap-1">
                            <Plus size={12} className="text-foreground" />
                            <Text className="text-xs">Add</Text>
                          </View>
                        </Button>
                      </View>
                    ))}
                </View>
              )}

              {syncedCalendars.length === 0 &&
                availableCalendars.filter((c) => !c.isAlreadyAdded).length === 0 && (
                  <Text className="text-sm text-muted-foreground">
                    Select an account to see available calendars
                  </Text>
                )}
            </View>
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              {isDarkMode ? (
                <Moon size={20} className="text-foreground" />
              ) : (
                <Sun size={20} className="text-foreground" />
              )}
              <Text>Dark Mode</Text>
            </View>
            <Switch checked={isDarkMode} onCheckedChange={toggleColorScheme} />
          </View>
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="gap-4">
            <View>
              <Text className="text-sm text-muted-foreground mb-2">API URL</Text>
              <Input
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="http://localhost:3000"
                editable={false}
              />
              <Text className="text-xs text-muted-foreground mt-1">
                Configure in app.json or environment variables
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <View className="flex-row items-center gap-2 flex-1">
                <Server size={16} className="text-muted-foreground" />
                <Text className="text-sm">
                  Status:{' '}
                  {isLoading ? (
                    <Text className="text-muted-foreground">Checking...</Text>
                  ) : healthData ? (
                    <Text className="text-green-600">Connected</Text>
                  ) : (
                    <Text className="text-destructive">Disconnected</Text>
                  )}
                </Text>
              </View>
              <Button onPress={handleTestConnection} variant="outline" size="sm">
                <Text>Test</Text>
              </Button>
            </View>

            <Button onPress={handleOpenDocs} variant="outline">
              <View className="flex-row items-center gap-2">
                <ExternalLink size={16} className="text-foreground" />
                <Text>Open API Docs</Text>
              </View>
            </Button>
          </View>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <Info size={20} className="text-muted-foreground" />
              <View>
                <Text className="font-medium">Shuchu Mobile</Text>
                <Text className="text-sm text-muted-foreground">
                  Task management with focus tracking
                </Text>
              </View>
            </View>

            <Separator />

            <View className="flex-row justify-between">
              <Text className="text-sm text-muted-foreground">Version</Text>
              <Text className="text-sm">{appVersion}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-sm text-muted-foreground">Platform</Text>
              <Text className="text-sm">Expo / React Native</Text>
            </View>
          </View>
        </CardContent>
      </Card>
    </View>
  );
}
