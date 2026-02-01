import type { RouteHandler } from '@hono/zod-openapi'
import { healthRoute } from '../routes/health'

// Re-export all handlers for convenient importing
export * from './tasks'
export * from './timers'
export * from './tags'
export * from './comments'
export * from './activities'
export * from './oauth'

// Health check handler  
export const healthHandler: RouteHandler<typeof healthRoute> = (c) => {
  return c.json(
    {
      status: 'ok',
      message: 'Shuchu API is running',
      timestamp: new Date().toISOString()
    },
    200
  )
}
