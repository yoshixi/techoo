import { describe, expect, it } from 'vitest'
import { createApp } from '../route'

describe('API versioning', () => {
  it('serves calendars and events under /api/v1 and leaves auth, oauth, and webhooks unversioned', () => {
    const { app } = createApp({ skipEnvValidation: true })
    const doc = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'Techoo API', version: '1.0.0' },
    })
    const paths = Object.keys(doc.paths ?? {})

    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/calendars',
        '/api/v1/calendars/available',
        '/api/v1/calendars/{id}',
        '/api/v1/calendars/{id}/sync',
        '/api/v1/calendars/sync',
        '/api/v1/calendars/{id}/watch',
        '/api/v1/events',
        '/api/v1/events/{id}',
        '/api/webhooks/google-calendar',
        '/api/oauth/google',
        '/api/oauth/google/status',
        '/api/oauth/google/accounts',
        '/api/health',
        '/api/token',
        '/api/session',
        '/api/session-code',
        '/api/account',
      ])
    )

    for (const removed of [
      '/api/calendars',
      '/api/calendars/available',
      '/api/calendars/{id}',
      '/api/calendars/sync',
      '/api/calendars/{id}/sync',
      '/api/calendars/{id}/watch',
      '/api/events',
      '/api/events/{id}',
    ]) {
      expect(paths).not.toContain(removed)
    }

    expect(doc.paths?.['/api/v1/calendars']).toMatchObject({
      get: expect.any(Object),
      post: expect.any(Object),
    })
    expect(doc.paths?.['/api/v1/calendars/{id}/watch']).toMatchObject({
      get: expect.any(Object),
      post: expect.any(Object),
      delete: expect.any(Object),
    })
    expect(doc.paths?.['/api/v1/events']?.get).toEqual(expect.any(Object))
    expect(doc.paths?.['/api/webhooks/google-calendar']?.post).toEqual(expect.any(Object))
  })
})
