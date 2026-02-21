import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { API_BASE_URL } from './api/mutator'
import { setSessionToken, getJwt, getSessionToken } from './auth'

/**
 * Sign in with Google OAuth using the system browser.
 * Opens the mobile-oauth endpoint, which redirects to Google.
 * On completion, Google redirects back through mobile-auth-callback,
 * which deep-links to shuchu://auth-callback?session_token=...
 */
export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = Linking.createURL('auth-callback')
  const oauthUrl = `${API_BASE_URL}/api/mobile-oauth?provider=google&redirect_uri=${encodeURIComponent(redirectUrl)}`

  const result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUrl)

  if (result.type !== 'success') {
    throw new Error('OAuth sign in was cancelled or failed')
  }

  const url = new URL(result.url)
  const sessionToken = url.searchParams.get('session_token')

  if (!sessionToken) {
    throw new Error('No session token received from OAuth callback')
  }

  await setSessionToken(sessionToken)

  // Exchange session token for JWT to confirm it's valid
  const jwt = await getJwt()
  if (!jwt) {
    throw new Error('Failed to obtain access token after OAuth')
  }
}

/**
 * Link a Google account to the current user session.
 * Opens the mobile-link endpoint, which redirects to Google for account linking.
 * On completion, redirects back to shuchu://link-callback?linked=1
 */
export async function linkGoogleAccount(): Promise<void> {
  const redirectUrl = Linking.createURL('link-callback')
  const sessionToken = await getSessionToken()
  if (!sessionToken) {
    throw new Error('No session token — sign in first')
  }

  const linkUrl = `${API_BASE_URL}/api/mobile-link?provider=google&redirect_uri=${encodeURIComponent(redirectUrl)}&session_token=${encodeURIComponent(sessionToken)}`

  const result = await WebBrowser.openAuthSessionAsync(linkUrl, redirectUrl)

  if (result.type !== 'success') {
    throw new Error('Account linking was cancelled or failed')
  }

  const url = new URL(result.url)
  if (url.searchParams.get('linked') !== '1') {
    throw new Error('Account linking did not complete successfully')
  }
}
