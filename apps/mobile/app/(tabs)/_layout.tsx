import { Tabs, Redirect } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { CheckSquare, MessageSquare } from 'lucide-react-native';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { NAV_THEME, THEME } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme ?? 'light';
  const theme = NAV_THEME[scheme];
  const palette = THEME[scheme];
  /** Soft hairline: avoid iOS default shadow (reads as a harsh black line). */
  const tabBarChrome =
    scheme === 'dark'
      ? {
          borderTopColor: 'hsla(32, 12%, 92%, 0.12)',
        }
      : {
          borderTopColor: 'hsla(36, 8%, 11%, 0.09)',
        };
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.mutedForeground,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...tabBarChrome,
          elevation: 0,
          shadowOpacity: 0,
          shadowOffset: { width: 0, height: 0 },
          shadowColor: 'transparent',
          ...(Platform.OS === 'android' ? { borderTopWidth: 1 } : {}),
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ToDos',
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, size }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="todos" options={{ href: null }} />
      <Tabs.Screen name="notes" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
