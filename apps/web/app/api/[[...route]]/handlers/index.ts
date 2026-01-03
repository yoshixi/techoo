import type { Context } from 'hono'

// Re-export all handlers for convenient importing
export * from './tasks'
export * from './timers'

// Health check handler  
export const healthHandler = (c: Context) => {
  return c.json({
    status: 'ok',
    message: 'Shuchu API is running',
    timestamp: new Date().toISOString()
  })
}
