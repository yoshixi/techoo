import { createRoute } from '@hono/zod-openapi'
import { TaskActivitiesParamModel, TaskActivitiesResponseModel } from '../../../core/activities.core'
import { ErrorResponseModel } from '../../../core/common.core'

export const getTaskActivitiesRoute = createRoute({
  method: 'get',
  path: '/tasks/{id}/activities',
  summary: 'Get combined task activity timeline',
  request: {
    params: TaskActivitiesParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskActivitiesResponseModel
        }
      },
      description: 'Activities retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Task not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Internal server error'
    }
  }
})
