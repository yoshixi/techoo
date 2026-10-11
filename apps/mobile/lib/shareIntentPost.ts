/**
 * Turn a native share payload into a timeline post body.
 * Text and links are saved. File-only shares (photos, videos) have no body.
 */
export type ShareIntentPostSource = {
  text?: string | null;
  webUrl?: string | null;
  meta?: { title?: string | null } | null;
};

export function shareIntentToPostBody(intent: ShareIntentPostSource): string {
  const text = intent.text?.trim() ?? '';
  const webUrl = intent.webUrl?.trim() ?? '';
  const title = intent.meta?.title?.trim() ?? '';

  const parts: string[] = [];
  if (title && title !== text && title !== webUrl && !text.includes(title)) {
    parts.push(title);
  }
  if (text && text !== webUrl) {
    parts.push(text);
  }
  if (webUrl && !parts.some((part) => part.includes(webUrl))) {
    parts.push(webUrl);
  }
  return parts.join('\n\n').trim();
}

/** True when the iOS share extension opened the app with a share payload. */
export function isIncomingShareIntentPath(path: string, extensionKey: string): boolean {
  if (!path || !extensionKey) return false;
  return path.includes(`dataUrl=${extensionKey}`);
}
