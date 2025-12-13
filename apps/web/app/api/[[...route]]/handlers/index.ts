// Re-export all handlers for convenient importing
export * from './tasks'
export * from './timers'

// Health check handler  
export const healthHandler = (c: any) => {
  return c.json({
    status: 'ok',
    message: 'Shuchu API is running',
    timestamp: new Date().toISOString()
  })
}