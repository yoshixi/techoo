import { createRoute } from '@hono/zod-openapi'
import {
  CalendarEventListResponseModel,
  CalendarEventResponseModel,
  CalendarEventQueryParamsModel,
  CalendarEventIdParamModel
} from '../../../core/events.core'
import { ErrorResponseModel } from '../../../core/common.core'

// GET /events - List events with filters
export const listEventsRoute = createRoute({
  method: 'get',
  path: '/events',
  summary: 'List calendar events',
  description: 'Retrieve calendar events with optional filters (calendarId, startDate, endDate)',
  request: {
    query: CalendarEventQueryParamsModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarEventListResponseModel
        }
      },
      description: 'Events retrieved successfully'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to retrieve events'
    }
  }
})

// GET /events/{id} - Get a specific event
export const getEventRoute = createRoute({
  method: 'get',
  path: '/events/{id}',
  summary: 'Get an event',
  description: 'Retrieve a specific calendar event by ID',
  request: {
    params: CalendarEventIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarEventResponseModel
        }
      },
      description: 'Event retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Event not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to retrieve event'
    }
  }
})
