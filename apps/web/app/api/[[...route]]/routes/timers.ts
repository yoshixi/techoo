import { createRoute } from '@hono/zod-openapi'
import {
  TimerListResponseModel,
  TimerIdParamModel,
  TimerResponseModel,
  CreateTimerModel,
  UpdateTimerModel,
  TaskIdForTimersParamModel
} from '../../../core/timers.core'
import { ErrorResponseModel } from '../../../core/common.core'

// GET /timers - List all timers
export const listTimersRoute = createRoute({
  method: 'get',
  path: '/timers',
  summary: 'Get all timers',
  description: 'Retrieve all timers across all tasks',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TimerListResponseModel
        }
      },
      description: 'Timers retrieved successfully'
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

// GET /tasks/{taskId}/timers - Get timers for a specific task
export const getTaskTimersRoute = createRoute({
  method: 'get',
  path: '/tasks/{taskId}/timers',
  summary: 'Get timers for a task',
  description: 'Retrieve all timers for a specific task',
  request: {
    params: TaskIdForTimersParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TimerListResponseModel
        }
      },
      description: 'Timers retrieved successfully'
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

// GET /timers/{id} - Get a specific timer
export const getTimerRoute = createRoute({
  method: 'get',
  path: '/timers/{id}',
  summary: 'Get a timer by ID',
  description: 'Retrieve a specific timer by its ID',
  request: {
    params: TimerIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TimerResponseModel
        }
      },
      description: 'Timer retrieved successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Timer not found'
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

// POST /timers - Create a new timer
export const createTimerRoute = createRoute({
  method: 'post',
  path: '/timers',
  summary: 'Create a new timer',
  description: 'Start a new timer for a task',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTimerModel
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TimerResponseModel
        }
      },
      description: 'Timer created successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Invalid request data'
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

// PUT /timers/{id} - Update a timer
export const updateTimerRoute = createRoute({
  method: 'put',
  path: '/timers/{id}',
  summary: 'Update a timer',
  description: 'Update an existing timer (typically to set end time)',
  request: {
    params: TimerIdParamModel,
    body: {
      content: {
        'application/json': {
          schema: UpdateTimerModel
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TimerResponseModel
        }
      },
      description: 'Timer updated successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Timer not found'
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

// DELETE /timers/{id} - Delete a timer
export const deleteTimerRoute = createRoute({
  method: 'delete',
  path: '/timers/{id}',
  summary: 'Delete a timer',
  description: 'Delete a timer',
  request: {
    params: TimerIdParamModel
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TimerResponseModel
        }
      },
      description: 'Timer deleted successfully'
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseModel
        }
      },
      description: 'Timer not found'
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