import { getShareExtensionKey } from 'expo-share-intent';
import { isIncomingShareIntentPath } from '@/lib/shareIntentPost';

/**
 * iOS opens the app with `techoo://dataUrl=techooShareKey`.
 * Send that launch to the share composer; the share hook still reads the original URL.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (isIncomingShareIntentPath(path, getShareExtensionKey())) {
      return '/shareintent';
    }
    return path;
  } catch {
    return path || '/';
  }
}
