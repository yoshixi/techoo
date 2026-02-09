import { z } from '@hono/zod-openapi'
import { IdSchema } from './common.core'
import { ProviderTypeEnum } from './oauth.core'

// Calendar event model (API representation)
export const CalendarEventModel = z.object({
  id: z.string().openapi({
    description: 'Unique identifier for the event'
  }),
  calendarId: z.string().openapi({
    description: 'Calendar ID this event belongs to'
  }),
  providerType: ProviderTypeEnum.openapi({
    description: 'Event provider type',
    example: 'google'
  }),
  providerEventId: z.string().openapi({
    description: 'Provider-specific event ID',
    example: 'abc123xyz'
  }),
  title: z.string().openapi({
    description: 'Event title',
    example: 'Team Meeting'
  }),
  description: z.string().nullable().openapi({
    description: 'Event description',
    example: 'Weekly team sync'
  }),
  startAt: z.string().openapi({
    description: 'Event start time',
    example: '2024-01-15T10:00:00.000Z'
  }),
  endAt: z.string().openapi({
    description: 'Event end time',
    example: '2024-01-15T11:00:00.000Z'
  }),
  isAllDay: z.boolean().openapi({
    description: 'Whether this is an all-day event',
    example: false
  }),
  location: z.string().nullable().openapi({
    description: 'Event location',
    example: 'Conference Room A'
  }),
  createdAt: z.string().openapi({
    description: 'Timestamp when the event was imported',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.string().openapi({
    description: 'Timestamp when the event was last updated',
    example: '2024-01-01T15:30:00.000Z'
  })
}).openapi('CalendarEvent')

// Event list response
export const CalendarEventListResponseModel = z.object({
  events: z.array(CalendarEventModel).openapi({
    description: 'List of calendar events'
  }),
  total: z.number().int().min(0).openapi({
    description: 'Total number of events',
    example: 15
  })
}).openapi('CalendarEventListResponse')

// Single event response
export const CalendarEventResponseModel = z.object({
  event: CalendarEventModel
}).openapi('CalendarEventResponse')

// Event query parameters
export const CalendarEventQueryParamsModel = z.object({
  calendarId: IdSchema.optional().openapi({
    description: 'Filter events by calendar ID'
  }),
  startDate: z.string().optional().openapi({
    description: 'Filter events starting from this date (inclusive)',
    example: '2024-01-01T00:00:00.000Z'
  }),
  endDate: z.string().optional().openapi({
    description: 'Filter events ending before this date (inclusive)',
    example: '2024-01-31T23:59:59.000Z'
  })
}).openapi('CalendarEventQueryParams')

// Path parameter models
export const CalendarEventIdParamModel = z.object({
  id: IdSchema.openapi({
    description: 'Event ID',
    param: {
      name: 'id',
      in: 'path'
    }
  })
}).openapi('CalendarEventIdParam')

// Export types
export type CalendarEvent = z.infer<typeof CalendarEventModel>
export type CalendarEventListResponse = z.infer<typeof CalendarEventListResponseModel>
export type CalendarEventResponse = z.infer<typeof CalendarEventResponseModel>
export type CalendarEventQueryParams = z.infer<typeof CalendarEventQueryParamsModel>
export type CalendarEventIdParam = z.infer<typeof CalendarEventIdParamModel>
