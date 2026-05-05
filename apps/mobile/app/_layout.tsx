import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SWRConfig } from 'swr';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthContext, useAuthProvider } from '@/hooks/useAuth';
import { isApiRequestError } from '@/lib/api/ApiRequestError';

/**
 * SWR sometimes leaves revalidation promises floating; we already surface these in
 * `customInstance` via `reportApiFailure`. Mark matching rejections as handled so RN
 * does not show a second red LogBox for the same failure.
 */
function SwallowTrackedApiRejections() {
  useEffect(() => {
    const g = globalThis as typeof globalThis & {
      addEventListener?: (type: string, listener: (ev: { preventDefault?: () => void; reason?: unknown }) => void) => void
      removeEventListener?: (type: string, listener: (ev: { preventDefault?: () => void; reason?: unknown }) => void) => void
    };
    const handler = (event: { preventDefault?: () => void; reason?: unknown }) => {
      const r = event.reason;
      if (isApiRequestError(r) || (r instanceof Error && r.message === 'Unauthorized')) {
        event.preventDefault?.();
      }
    };
    g.addEventListener?.('unhandledrejection', handler);
    return () => g.removeEventListener?.('unhandledrejection', handler);
  }, []);
  return null;
}

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const auth = useAuthProvider();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={auth}>
        <SwallowTrackedApiRejections />
        <SWRConfig
          value={{
            revalidateOnFocus: true,
            revalidateOnReconnect: true,
            dedupingInterval: 2000,
          }}
        >
          <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen
                name="todo/[id]"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="note/[id]"
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
            </Stack>
            <PortalHost />
          </ThemeProvider>
        </SWRConfig>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
