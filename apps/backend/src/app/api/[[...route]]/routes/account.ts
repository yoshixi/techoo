import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import { ErrorResponseModel } from '../../../core/common.core'

const DeleteAccountResponseModel = z.object({
  message: z.string(),
}).openapi('DeleteAccountResponse')

export const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/account',
  summary: 'Delete account',
  description: 'Delete the authenticated user and all their data including tenant database.',
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteAccountResponseModel } },
      description: 'Account deleted successfully',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseModel } },
      description: 'Internal server error',
    },
  },
})
