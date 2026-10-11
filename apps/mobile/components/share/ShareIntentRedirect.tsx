import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { armShareIntentSession, isShareIntentSessionDismissed } from '@/lib/shareIntentSession';

/** Opens the share composer when another app hands Techoo a share payload. */
export function ShareIntentRedirect() {
  const { hasShareIntent, isReady } = useShareIntentContext();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!hasShareIntent) {
      armShareIntentSession();
      return;
    }
    if (isShareIntentSessionDismissed()) return;
    if (pathname === '/shareintent' || pathname === '/auth') return;
    router.push('/shareintent');
  }, [hasShareIntent, isReady, pathname, router]);

  return null;
}
