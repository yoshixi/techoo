import { z } from '@hono/zod-openapi'
import { IdSchema } from './common.core'
import { ProviderTypeEnum } from './oauth.core'

// Calendar model (API representation)
export const CalendarModel = z.object({
  id: z.string().openapi({
    description: 'Unique identifier for the calendar'
  }),
  userId: z.string().openapi({
    description: 'User ID'
  }),
  providerType: ProviderTypeEnum.openapi({
    description: 'Calendar provider type',
    example: 'google'
  }),
  providerCalendarId: z.string().openapi({
    description: 'Provider-specific calendar ID',
    example: 'primary'
  }),
  name: z.string().openapi({
    description: 'Calendar display name',
    example: 'Work Calendar'
  }),
  color: z.string().nullable().openapi({
    description: 'Calendar color',
    example: '#4285f4'
  }),
  isEnabled: z.boolean().openapi({
    description: 'Whether the calendar is enabled for sync',
    example: true
  }),
  lastSyncedAt: z.string().nullable().openapi({
    description: 'Timestamp of last sync',
    example: '2024-01-01T10:00:00.000Z'
  }),
  createdAt: z.string().openapi({
    description: 'Timestamp when the calendar was added',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.string().openapi({
    description: 'Timestamp when the calendar was last updated',
    example: '2024-01-01T15:30:00.000Z'
  })
}).openapi('Calendar')

// Available calendar from provider (for selection)
export const AvailableCalendarModel = z.object({
  providerCalendarId: z.string().openapi({
    description: 'Provider-specific calendar ID',
    example: 'primary'
  }),
  name: z.string().openapi({
    description: 'Calendar display name',
    example: 'Work Calendar'
  }),
  color: z.string().optional().openapi({
    description: 'Calendar color',
    example: '#4285f4'
  }),
  isPrimary: z.boolean().optional().openapi({
    description: 'Whether this is the primary calendar',
    example: true
  }),
  isAlreadyAdded: z.boolean().openapi({
    description: 'Whether this calendar has already been added',
    example: false
  })
}).openapi('AvailableCalendar')

// Create calendar input
export const CreateCalendarModel = z.object({
  providerCalendarId: z.string().openapi({
    description: 'Provider-specific calendar ID to add',
    example: 'primary'
  }),
  name: z.string().optional().openapi({
    description: 'Custom display name (defaults to provider name)',
    example: 'My Work Calendar'
  }),
  isEnabled: z.boolean().optional().default(true).openapi({
    description: 'Whether to enable sync immediately',
    example: true
  })
}).openapi('CreateCalendar')

// Update calendar input
export const UpdateCalendarModel = z.object({
  name: z.string().optional().openapi({
    description: 'Updated display name',
    example: 'My Personal Calendar'
  }),
  isEnabled: z.boolean().optional().openapi({
    description: 'Whether to enable/disable sync',
    example: true
  })
}).openapi('UpdateCalendar')

// Calendar list response
export const CalendarListResponseModel = z.object({
  calendars: z.array(CalendarModel).openapi({
    description: 'List of integrated calendars'
  }),
  total: z.number().int().min(0).openapi({
    description: 'Total number of calendars',
    example: 3
  })
}).openapi('CalendarListResponse')

// Available calendars response
export const AvailableCalendarsResponseModel = z.object({
  calendars: z.array(AvailableCalendarModel).openapi({
    description: 'List of available calendars from provider'
  })
}).openapi('AvailableCalendarsResponse')

// Single calendar response
export const CalendarResponseModel = z.object({
  calendar: CalendarModel
}).openapi('CalendarResponse')

// Sync response
export const CalendarSyncResponseModel = z.object({
  success: z.boolean().openapi({
    description: 'Whether the sync was successful'
  }),
  message: z.string().openapi({
    description: 'Sync result message',
    example: 'Synced 42 events'
  }),
  eventsCount: z.number().int().min(0).openapi({
    description: 'Number of events synced',
    example: 42
  })
}).openapi('CalendarSyncResponse')

// Path parameter models
export const CalendarIdParamModel = z.object({
  id: IdSchema.openapi({
    description: 'Calendar ID',
    param: {
      name: 'id',
      in: 'path'
    }
  })
}).openapi('CalendarIdParam')

// Export types
export type Calendar = z.infer<typeof CalendarModel>
export type AvailableCalendar = z.infer<typeof AvailableCalendarModel>
export type CreateCalendar = z.infer<typeof CreateCalendarModel>
export type UpdateCalendar = z.infer<typeof UpdateCalendarModel>
export type CalendarListResponse = z.infer<typeof CalendarListResponseModel>
export type AvailableCalendarsResponse = z.infer<typeof AvailableCalendarsResponseModel>
export type CalendarResponse = z.infer<typeof CalendarResponseModel>
export type CalendarSyncResponse = z.infer<typeof CalendarSyncResponseModel>
export type CalendarIdParam = z.infer<typeof CalendarIdParamModel>
