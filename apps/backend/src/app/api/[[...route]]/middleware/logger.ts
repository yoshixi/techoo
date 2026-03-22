import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { rootLogger } from '../../../lib/logger'

export function registerLoggerMiddleware(app: OpenAPIHono<AppBindings>) {
  app.use('/*', async (c, next) => {
    const requestId = crypto.randomUUID()
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
    const country = c.req.header('cf-ipcountry') || 'unknown'
    const logger = rootLogger.child({
      requestId,
      method: c.req.method,
      path: c.req.path,
      ip,
      country,
    })

    c.set('logger', logger)
    c.set('requestId', requestId)

    const start = Date.now()
    logger.info('request started')

    await next()

    const duration = Date.now() - start
    const status = c.res.status

    if (status >= 500) {
      logger.error({ status, duration }, 'request completed')
    } else {
      logger.info({ status, duration }, 'request completed')
    }
  })
}
