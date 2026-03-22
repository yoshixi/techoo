import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings, Auth } from '../types'
import { createExchangeCode, consumeExchangeCode } from '../../../core/exchange-codes'
import { isAllowedMobileRedirectUri } from '../middleware/mobile-redirect'

/**
 * Register all OAuth flow endpoints (desktop and mobile) on the app.
 * These endpoints involve redirects, cookies, and HTML responses that
 * don't map cleanly to OpenAPI, so they use plain Hono route handlers.
 */
export function registerOAuthRoutes(app: OpenAPIHono<AppBindings>, auth: Auth) {
  // --- Desktop OAuth ---

  // Desktop app OAuth initiation: the browser navigates here directly so that
  // better-auth's state cookie is set in the browser's cookie jar.
  app.get('/oauth/desktop', async (c) => {
    const provider = c.req.query('provider')
    const port = c.req.query('port')
    if (!provider || !port) {
      return c.text('Missing provider or port parameter', 400)
    }

    const url = new URL(c.req.url)
    const baseUrl = url.origin
    const callbackURL = `${baseUrl}/api/oauth/desktop/callback?port=${port}`

    const authResponse = await auth.handler(
      new Request(`${baseUrl}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          Origin: baseUrl,
        }),
        body: JSON.stringify({ provider, callbackURL }),
      })
    )

    const setCookies = authResponse.headers.getSetCookie()

    let oauthUrl: string | null = null
    if (authResponse.status >= 300 && authResponse.status < 400) {
      oauthUrl = authResponse.headers.get('location')
    } else if (authResponse.ok) {
      const data = (await authResponse.json()) as { url?: string }
      oauthUrl = data?.url ?? null
    }

    if (!oauthUrl) {
      return c.text('Failed to initiate OAuth', 500)
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: oauthUrl },
    })
    for (const cookie of setCookies) {
      response.headers.append('Set-Cookie', cookie)
    }
    return response
  })

  // Desktop app OAuth callback: reads the session cookie set by better-auth and
  // redirects to the Electron loopback server with a short-lived code.
  app.get('/oauth/desktop/callback', async (c) => {
    const port = c.req.query('port')
    if (!port) {
      return c.text('Missing port parameter', 400)
    }

    const cookies = c.req.header('cookie') || ''
    const match = cookies.match(/better-auth\.session_token=([^;]+)/)
    const sessionToken = match?.[1] || undefined

    if (!sessionToken) {
      return c.html(
        '<html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Authentication failed</h1><p>Session token not found. Please close this window and try again.</p></body></html>',
        401
      )
    }

    const code = await createExchangeCode(sessionToken)
    return c.redirect(
      `http://127.0.0.1:${port}/callback?code=${encodeURIComponent(code)}`
    )
  })

  // Desktop app account linking initiation: ensures OAuth state cookie is set in the browser.
  app.get('/oauth/desktop-link', async (c) => {
    const provider = c.req.query('provider')
    const port = c.req.query('port')
    const sessionCode = c.req.query('session_code')
    if (!provider || !port || !sessionCode) {
      return c.text('Missing provider, port, or session code', 400)
    }

    const sessionToken = await consumeExchangeCode(sessionCode)
    if (!sessionToken) {
      return c.text('Invalid or expired session code', 401)
    }

    const url = new URL(c.req.url)
    const baseUrl = url.origin
    const callbackURL = `http://127.0.0.1:${port}/callback?linked=1`

    const authResponse = await auth.handler(
      new Request(`${baseUrl}/api/auth/link-social`, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          Origin: baseUrl,
          Authorization: `Bearer ${sessionToken}`
        }),
        body: JSON.stringify({ provider, callbackURL, disableRedirect: true })
      })
    )

    const setCookies = authResponse.headers.getSetCookie()

    let oauthUrl: string | null = null
    if (authResponse.ok) {
      const data = (await authResponse.json()) as { url?: string }
      oauthUrl = data?.url ?? null
    }

    if (!oauthUrl) {
      return c.text('Failed to initiate link flow', 500)
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: oauthUrl }
    })
    for (const cookie of setCookies) {
      response.headers.append('Set-Cookie', cookie)
    }
    return response
  })

  // --- Mobile OAuth ---

  // Mobile app OAuth initiation: same pattern as desktop but uses deep link redirect
  app.get('/oauth/mobile', async (c) => {
    const provider = c.req.query('provider')
    const redirectUri = c.req.query('redirect_uri')
    if (!provider || !redirectUri) {
      return c.text('Missing provider or redirect_uri parameter', 400)
    }
    if (!isAllowedMobileRedirectUri(redirectUri)) {
      return c.text('Untrusted redirect_uri parameter', 400)
    }

    const url = new URL(c.req.url)
    const baseUrl = url.origin
    const callbackURL = `${baseUrl}/api/oauth/mobile/callback?redirect_uri=${encodeURIComponent(redirectUri)}`

    const authResponse = await auth.handler(
      new Request(`${baseUrl}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          Origin: baseUrl,
        }),
        body: JSON.stringify({ provider, callbackURL }),
      })
    )

    const setCookies = authResponse.headers.getSetCookie()

    let oauthUrl: string | null = null
    if (authResponse.status >= 300 && authResponse.status < 400) {
      oauthUrl = authResponse.headers.get('location')
    } else if (authResponse.ok) {
      const data = (await authResponse.json()) as { url?: string }
      oauthUrl = data?.url ?? null
    }

    if (!oauthUrl) {
      return c.text('Failed to initiate OAuth', 500)
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: oauthUrl },
    })
    for (const cookie of setCookies) {
      response.headers.append('Set-Cookie', cookie)
    }
    return response
  })

  // Mobile app OAuth callback: reads session cookie and redirects to deep link
  app.get('/oauth/mobile/callback', async (c) => {
    const redirectUri = c.req.query('redirect_uri')
    if (!redirectUri) {
      return c.text('Missing redirect_uri parameter', 400)
    }
    if (!isAllowedMobileRedirectUri(redirectUri)) {
      return c.text('Untrusted redirect_uri parameter', 400)
    }

    const cookies = c.req.header('cookie') || ''
    const match = cookies.match(/better-auth\.session_token=([^;]+)/)
    const sessionToken = match?.[1] || undefined

    if (!sessionToken) {
      return c.html(
        '<html><body style="font-family:system-ui;text-align:center;padding:3rem"><h1>Authentication failed</h1><p>Session token not found. Please close this window and try again.</p></body></html>',
        401
      )
    }

    const separator = redirectUri.includes('?') ? '&' : '?'
    const code = await createExchangeCode(sessionToken)
    return c.redirect(
      `${redirectUri}${separator}code=${encodeURIComponent(code)}`
    )
  })

  // Mobile app account linking initiation: same as desktop-link but uses deep link redirect
  app.get('/oauth/mobile-link', async (c) => {
    const provider = c.req.query('provider')
    const redirectUri = c.req.query('redirect_uri')
    const sessionCode = c.req.query('session_code')
    if (!provider || !redirectUri || !sessionCode) {
      return c.text('Missing provider, redirect_uri, or session_code parameter', 400)
    }
    if (!isAllowedMobileRedirectUri(redirectUri)) {
      return c.text('Untrusted redirect_uri parameter', 400)
    }

    const sessionToken = await consumeExchangeCode(sessionCode)
    if (!sessionToken) {
      return c.text('Invalid or expired session code', 401)
    }

    const url = new URL(c.req.url)
    const baseUrl = url.origin
    const callbackURL = `${baseUrl}/api/oauth/mobile-link/callback?redirect_uri=${encodeURIComponent(redirectUri)}`

    const authResponse = await auth.handler(
      new Request(`${baseUrl}/api/auth/link-social`, {
        method: 'POST',
        headers: new Headers({
          'Content-Type': 'application/json',
          Origin: baseUrl,
          Authorization: `Bearer ${sessionToken}`
        }),
        body: JSON.stringify({ provider, callbackURL, disableRedirect: true })
      })
    )

    const setCookies = authResponse.headers.getSetCookie()

    let oauthUrl: string | null = null
    if (authResponse.ok) {
      const data = (await authResponse.json()) as { url?: string }
      oauthUrl = data?.url ?? null
    }

    if (!oauthUrl) {
      return c.text('Failed to initiate link flow', 500)
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: oauthUrl }
    })
    for (const cookie of setCookies) {
      response.headers.append('Set-Cookie', cookie)
    }
    return response
  })

  // Mobile app account linking callback: reads session cookie and redirects to deep link
  app.get('/oauth/mobile-link/callback', async (c) => {
    const redirectUri = c.req.query('redirect_uri')
    if (!redirectUri) {
      return c.text('Missing redirect_uri parameter', 400)
    }
    if (!isAllowedMobileRedirectUri(redirectUri)) {
      return c.text('Untrusted redirect_uri parameter', 400)
    }

    const separator = redirectUri.includes('?') ? '&' : '?'
    return c.redirect(`${redirectUri}${separator}linked=1`)
  })
}
