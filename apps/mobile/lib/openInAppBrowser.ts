import * as WebBrowser from 'expo-web-browser';

/** Opens a URL in the platform in-app browser (Safari VC / Chrome Custom Tab). */
export async function openInAppBrowser(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  try {
    await WebBrowser.openBrowserAsync(trimmed, {
      dismissButtonStyle: 'close',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      enableBarCollapsing: true,
    });
  } catch {
    /* User dismissed or OS refused — ignore. */
  }
}
