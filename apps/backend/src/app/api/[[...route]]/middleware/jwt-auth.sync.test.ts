import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import pino from 'pino'
import type { AppBindings } from '../types'
import { getVaultRoute } from '../routes/vault'
import { pullSyncOpsRoute } from '../routes/sync'
import { getVaultHandler } from '../handlers/vault'
import { pullSyncOpsHandler } from '../handlers/sync'
import { verifyJwt } from '../../../core/jwt'
import { getTenantDbForUser } from '../../../core/common.db'
import { createOAuthService } from '../../../core/oauth.service'
import { registerJwtAuthMiddleware } from './jwt-auth'

vi.mock('../../../core/jwt', () => ({
  verifyJwt: vi.fn(),
}))

vi.mock('../../../core/common.db', () => ({
  getTenantDbForUser: vi.fn(),
}))

vi.mock('../../../core/oauth.service', () => ({
  createOAuthService: vi.fn(),
}))

function createApp() {
  const app = new OpenAPIHono<AppBindings>().basePath('/api')
  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }))
    c.set('requestId', 'test-request-id')
    await next()
  })
  registerJwtAuthMiddleware(app)
  app.openapi(getVaultRoute, getVaultHandler)
  app.openapi(pullSyncOpsRoute, pullSyncOpsHandler)
  return app
}

const app = createApp()

describe('JWT middleware for encrypted sync', () => {
  beforeEach(() => {
    vi.mocked(verifyJwt).mockReset()
    vi.mocked(getTenantDbForUser).mockReset()
    vi.mocked(createOAuthService).mockReset()
    vi.mocked(verifyJwt).mockResolvedValue({
      sub: '7',
      email: 'ada@example.com',
      name: 'Ada',
    })
    vi.mocked(getTenantDbForUser).mockReturnValue({} as ReturnType<typeof getTenantDbForUser>)
    vi.mocked(createOAuthService).mockReturnValue({} as ReturnType<typeof createOAuthService>)
  })

  it('serves vault and sync routes without opening a tenant database', async () => {
    const vault = await app.request('/api/v1/vault', {
      headers: { authorization: 'Bearer test-token' },
    })
    expect(vault.status).toBe(503)

    const ops = await app.request(
      '/api/v1/sync/ops?vaultId=00000000-0000-4000-8000-000000000001',
      { headers: { authorization: 'Bearer test-token' } },
    )
    expect(ops.status).toBe(503)

    expect(getTenantDbForUser).not.toHaveBeenCalled()
    expect(createOAuthService).not.toHaveBeenCalled()
    expect(verifyJwt).toHaveBeenCalledTimes(2)
  })

  it('still opens the tenant database for domain routes', async () => {
    const response = await app.request('/api/v1/todos', {
      headers: { authorization: 'Bearer test-token' },
    })

    expect(response.status).toBe(404)
    expect(getTenantDbForUser).toHaveBeenCalledWith(7)
    expect(createOAuthService).toHaveBeenCalledWith(7)
  })

  it('rejects a missing bearer token before any database lookup', async () => {
    const response = await app.request('/api/v1/vault')

    expect(response.status).toBe(401)
    expect(verifyJwt).not.toHaveBeenCalled()
    expect(getTenantDbForUser).not.toHaveBeenCalled()
    expect(createOAuthService).not.toHaveBeenCalled()
  })
})
