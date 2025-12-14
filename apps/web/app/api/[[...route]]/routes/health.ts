import { createRoute } from '@hono/zod-openapi'
import { HealthResponseModel } from '../../../core/common.core'

// GET /health - Health check endpoint
export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Check if the API is running',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseModel
        }
      },
      description: 'API is healthy'
    }
  }
})