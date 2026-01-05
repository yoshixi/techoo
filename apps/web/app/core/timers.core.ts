import { z } from '@hono/zod-openapi'
import { UUIDSchema } from './tasks.core'

// Base task timer model
export const TaskTimerModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Unique identifier for the timer'
  }),
  taskId: UUIDSchema.openapi({
    description: 'ID of the associated task'
  }),
  startTime: z.string().datetime().openapi({
    description: 'Timestamp when the timer was started',
    example: '2024-01-01T10:00:00.000Z'
  }),
  endTime: z.string().datetime().optional().nullable().openapi({
    description: 'Timestamp when the timer was ended (null for active timers)',
    example: '2024-01-01T10:25:00.000Z'
  }),
  createdAt: z.string().datetime().openapi({
    description: 'Timestamp when the timer was created',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.string().datetime().openapi({
    description: 'Timestamp when the timer was last updated',
    example: '2024-01-01T10:25:00.000Z'
  })
}).openapi('TaskTimer')

export const ListTimersQueryParamsModel = z
  .object({
    taskIds: z
      .preprocess((value) => {
        if (typeof value === 'string') {
          return value.includes(',') ? value.split(',').map((item) => item.trim()) : [value]
        }
        return value
      }, z.array(UUIDSchema))
      .optional()
      .openapi({
        description: 'IDs of the tasks to get timers for',
        example: ['01234567-89ab-cdef-0123-456789abcdef', '01234567-89ab-cdef-0123-456789abcdef']
      })
  })
  .openapi('ListTimersQueryParams')

// Create timer input model
export const CreateTimerModel = z.object({
  taskId: UUIDSchema.openapi({
    description: 'ID of the task to start timer for'
  }),
  startTime: z.string().datetime().openapi({
    description: 'Timestamp when the timer should start',
    example: '2024-01-01T10:00:00.000Z'
  })
}).openapi('CreateTimer')

// Update timer input model
export const UpdateTimerModel = z.object({
  endTime: z.string().datetime().optional().nullable().openapi({
    description: 'Timestamp when the timer ended. Use null to remove end time',
    example: '2024-01-01T10:25:00.000Z'
  })
}).openapi('UpdateTimer')

// Timer list response model
export const TimerListResponseModel = z.object({
  timers: z.array(TaskTimerModel).openapi({
    description: 'List of timers'
  }),
  total: z.number().int().min(0).openapi({
    description: 'Total number of timers',
    example: 5
  })
}).openapi('TimerListResponse')

// Single timer response model
export const TimerResponseModel = z.object({
  timer: TaskTimerModel
}).openapi('TimerResponse')

// Path parameter models
export const TimerIdParamModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Timer ID',
    param: {
      name: 'id',
      in: 'path'
    }
  })
}).openapi('TimerIdParam')

export const TaskIdForTimersParamModel = z.object({
  taskId: UUIDSchema.openapi({
    description: 'Task ID for timer operations',
    param: {
      name: 'taskId',
      in: 'path'
    }
  })
}).openapi('TaskIdForTimersParam')

// Export types
export type TaskTimer = z.infer<typeof TaskTimerModel>
export type CreateTimer = z.infer<typeof CreateTimerModel>
export type UpdateTimer = z.infer<typeof UpdateTimerModel>
export type TimerListResponse = z.infer<typeof TimerListResponseModel>
export type TimerResponse = z.infer<typeof TimerResponseModel>
export type TimerIdParam = z.infer<typeof TimerIdParamModel>
export type TaskIdForTimersParam = z.infer<typeof TaskIdForTimersParamModel>
