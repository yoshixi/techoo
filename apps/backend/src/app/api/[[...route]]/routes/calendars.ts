import { createRoute } from '@hono/zod-openapi'
import {
  CalendarListResponseModel,
  AvailableCalendarsResponseModel,
  CalendarResponseModel,
  CalendarSyncResponseModel,
  CreateCalendarModel,
  UpdateCalendarModel,
  CalendarIdParamModel
} from '../../../core/calendars.core'
import { ErrorResponseModel } from '../../../core/common.core'
import {
  WatchChannelResponseModel,
  WatchChannelStatusModel,
  StopWatchResponseModel
} from '../../../core/watch-channels.core'

// GET /calendars/available - List available calendars from Google
export const listAvailableCalendarsRoute = createRoute({
  method: 'get',
  path: '/calendars/available',
  summary: 'List available Google Calendars',
  description: 'Retrieve available calendars from Google Calendar API that can be synced',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: AvailableCalendarsResponseModel
        }
      },
      description: 'Available calendars retrieved successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Google OAuth not connected'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to retrieve calendars'
    }
  }
})

// GET /calendars - List integrated calendars
export const listCalendarsRoute = createRoute({
  method: 'get',
  path: '/calendars',
  summary: 'List integrated calendars',
  description: 'Retrieve all calendars that have been added for syncing',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarListResponseModel
        }
      },
      description: 'Calendars retrieved successfully'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to retrieve calendars'
    }
  }
})

// POST /calendars - Add a calendar to sync
export const createCalendarRoute = createRoute({
  method: 'post',
  path: '/calendars',
  summary: 'Add a calendar to sync',
  description: 'Add a Google Calendar to be synced',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateCalendarModel
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: CalendarResponseModel
        }
      },
      description: 'Calendar added successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Invalid request or calendar already added'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Google OAuth not connected'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to add calendar'
    }
  }
})

// GET /calendars/{id} - Get a specific calendar
export const getCalendarRoute = createRoute({
  method: 'get',
  path: '/calendars/{id}',
  summary: 'Get a calendar',
  description: 'Retrieve a specific calendar by ID',
  request: {
    params: CalendarIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarResponseModel
        }
      },
      description: 'Calendar retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to retrieve calendar'
    }
  }
})

// PATCH /calendars/{id} - Update a calendar
export const updateCalendarRoute = createRoute({
  method: 'patch',
  path: '/calendars/{id}',
  summary: 'Update a calendar',
  description: 'Update calendar settings (e.g., enable/disable sync)',
  request: {
    params: CalendarIdParamModel,
    body: {
      content: {
        'application/json': {
          schema: UpdateCalendarModel
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarResponseModel
        }
      },
      description: 'Calendar updated successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to update calendar'
    }
  }
})

// DELETE /calendars/{id} - Remove a calendar
export const deleteCalendarRoute = createRoute({
  method: 'delete',
  path: '/calendars/{id}',
  summary: 'Remove a calendar',
  description: 'Remove a calendar and delete all its synced events',
  request: {
    params: CalendarIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarResponseModel
        }
      },
      description: 'Calendar removed successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to remove calendar'
    }
  }
})

// POST /calendars/{id}/sync - Sync a specific calendar
export const syncCalendarRoute = createRoute({
  method: 'post',
  path: '/calendars/{id}/sync',
  summary: 'Sync a calendar',
  description: 'Trigger a sync for a specific calendar to import latest events',
  request: {
    params: CalendarIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarSyncResponseModel
        }
      },
      description: 'Calendar synced successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Google OAuth not connected or token expired'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to sync calendar'
    }
  }
})

// POST /calendars/sync - Sync all enabled calendars
export const syncAllCalendarsRoute = createRoute({
  method: 'post',
  path: '/calendars/sync',
  summary: 'Sync all calendars',
  description: 'Trigger a sync for all enabled calendars',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: CalendarSyncResponseModel
        }
      },
      description: 'Calendars synced successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Google OAuth not connected or token expired'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to sync calendars'
    }
  }
})

// POST /calendars/{id}/watch - Start watching a calendar for changes
export const watchCalendarRoute = createRoute({
  method: 'post',
  path: '/calendars/{id}/watch',
  summary: 'Watch calendar for changes',
  description:
    'Start watching a calendar for push notifications when events change',
  request: {
    params: CalendarIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WatchChannelResponseModel
        }
      },
      description: 'Watch channel created successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Google OAuth not connected or token expired'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to create watch channel'
    }
  }
})

// DELETE /calendars/{id}/watch - Stop watching a calendar
export const stopWatchingCalendarRoute = createRoute({
  method: 'delete',
  path: '/calendars/{id}/watch',
  summary: 'Stop watching calendar',
  description: 'Stop receiving push notifications for a calendar',
  request: {
    params: CalendarIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: StopWatchResponseModel
        }
      },
      description: 'Watch channel stopped successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Google OAuth not connected or token expired'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar or watch channel not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to stop watch channel'
    }
  }
})

// GET /calendars/{id}/watch - Get watch channel status
export const getWatchStatusRoute = createRoute({
  method: 'get',
  path: '/calendars/{id}/watch',
  summary: 'Get watch status',
  description: 'Get the current watch channel status for a calendar',
  request: {
    params: CalendarIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: WatchChannelStatusModel
        }
      },
      description: 'Watch status retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Calendar not found'
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Failed to retrieve watch status'
    }
  }
})
