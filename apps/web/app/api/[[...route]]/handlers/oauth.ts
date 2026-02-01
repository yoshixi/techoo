import type { RouteHandler } from '@hono/zod-openapi'
import { getAuthUrlRoute, exchangeTokenRoute } from '../routes/oauth'
import { getDb } from '../../../core/common.db'
import {
  createOAuthSession,
  getValidOAuthSession,
  deleteOAuthSession,
  cleanupExpiredSessions,
} from '../../../core/oauth.db'

// Get Clerk configuration from environment
const getClerkConfig = () => {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY
  const frontendApi = process.env.CLERK_FRONTEND_API

  if (!publishableKey || !frontendApi) {
    throw new Error('CLERK_PUBLISHABLE_KEY and CLERK_FRONTEND_API must be configured')
  }

  return { publishableKey, frontendApi }
}

/**
 * GET /auth/url - Generate OAuth authorization URL
 */
export const getAuthUrlHandler: RouteHandler<typeof getAuthUrlRoute> = async (c) => {
  try {
    const db = getDb()
    const { redirect_uri } = c.req.valid('query')

    // Validate redirect_uri (allow custom protocol for desktop apps)
    const allowedProtocols = ['shuchu:', 'http:', 'https:']
    try {
      const redirectUrl = new URL(redirect_uri)
      if (!allowedProtocols.some(p => redirectUrl.protocol === p)) {
        return c.json(
          { error: 'Invalid redirect_uri protocol' },
          400
        )
      }
    } catch {
      return c.json(
        { error: 'Invalid redirect_uri format' },
        400
      )
    }

    // Clean up expired sessions periodically (fire and forget)
    cleanupExpiredSessions(db).catch(console.error)

    // Create OAuth session with PKCE
    const session = await createOAuthSession(db, redirect_uri)

    // Build Clerk authorization URL
    const { publishableKey, frontendApi } = getClerkConfig()
    const authUrl = new URL(`https://${frontendApi}/oauth/authorize`)
    authUrl.searchParams.set('client_id', publishableKey)
    authUrl.searchParams.set('redirect_uri', redirect_uri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', session.state)
    authUrl.searchParams.set('code_challenge', session.codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('scope', 'openid profile email')

    return c.json(
      {
        authUrl: authUrl.toString(),
        sessionId: session.sessionId,
      },
      200
    )
  } catch (error) {
    console.error('Error generating auth URL:', error)
    return c.json(
      { error: 'Internal server error' },
      500
    )
  }
}

/**
 * POST /auth/token - Exchange authorization code for tokens
 */
export const exchangeTokenHandler: RouteHandler<typeof exchangeTokenRoute> = async (c) => {
  try {
    const db = getDb()
    const { code, state, sessionId } = c.req.valid('json')

    // Validate session
    const session = await getValidOAuthSession(db, sessionId, state)
    if (!session) {
      return c.json(
        { error: 'Invalid or expired session' },
        401
      )
    }

    // Exchange code for tokens with Clerk
    const { publishableKey, frontendApi } = getClerkConfig()
    const tokenUrl = `https://${frontendApi}/oauth/token`

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: publishableKey,
        code,
        redirect_uri: session.redirectUri,
        code_verifier: session.codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)

      // Clean up the session on failure
      await deleteOAuthSession(db, sessionId)

      return c.json(
        { error: 'Token exchange failed' },
        401
      )
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string
      id_token?: string
      refresh_token?: string
      expires_in?: number
    }

    // Delete session after successful exchange (one-time use)
    await deleteOAuthSession(db, sessionId)

    return c.json(
      {
        accessToken: tokenData.access_token,
        idToken: tokenData.id_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in || 3600,
      },
      200
    )
  } catch (error) {
    console.error('Error exchanging token:', error)
    return c.json(
      { error: 'Internal server error' },
      500
    )
  }
}
