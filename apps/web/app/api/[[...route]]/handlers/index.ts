import type { RouteHandler } from '@hono/zod-openapi'
import { healthRoute } from '../routes/health'
import type { AppBindings } from '../types'

// Re-export all handlers for convenient importing
export * from './tasks'
export * from './timers'
export * from './tags'
export * from './comments'
export * from './activities'
export * from './google-auth'
export * from './calendars'
export * from './events'
export * from './webhooks'

// Health check handler
export const healthHandler: RouteHandler<typeof healthRoute, AppBindings> = (c) => {
  return c.json(
    {
      status: 'ok',
      message: 'Shuchu API is running',
      timestamp: new Date().toISOString()
    },
    200
  )
}
