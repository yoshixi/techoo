import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'

// Webhook response model (empty success)
export const WebhookResponseModel = z.object({}).openapi('WebhookResponse')

// POST /webhooks/google-calendar - Receive Google Calendar push notifications
export const googleCalendarWebhookRoute = createRoute({
  method: 'post',
  path: '/webhooks/google-calendar',
  summary: 'Google Calendar webhook',
  description: 'Receives push notifications from Google Calendar when events change',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WebhookResponseModel
        }
      },
      description: 'Notification received successfully'
    },
    400: {
      description: 'Invalid notification'
    }
  }
})
