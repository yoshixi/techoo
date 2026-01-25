import { z } from '@hono/zod-openapi'
import { UUIDSchema } from './common.core'
import { TagModel } from './tags.core'

// Base task model
export const TaskModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Unique identifier for the task'
  }),
  title: z.string().min(1).max(200).openapi({
    description: 'Title of the task',
    example: 'Complete project documentation'
  }),
  description: z.string().openapi({
    description: 'Detailed description of the task',
    example: 'Write comprehensive documentation for the API endpoints'
  }),
  dueDate: z.iso.datetime().optional().nullable().openapi({
    description: 'Due date for the task in ISO 8601 format',
    example: '2024-12-31T23:59:59.000Z'
  }),
  startAt: z.iso.datetime().optional().nullable().openapi({
    description: 'Start date for the task in ISO 8601 format',
    example: '2024-01-01T09:00:00.000Z'
  }),
  endAt: z.iso.datetime().optional().nullable().openapi({
    description: 'End date for the task in ISO 8601 format',
    example: '2024-01-01T17:00:00.000Z'
  }),
  completedAt: z.iso.datetime().optional().nullable().openapi({
    description: 'Completion timestamp in ISO 8601 format',
    example: '2024-01-02T08:00:00.000Z'
  }),
  tags: z.array(TagModel).openapi({
    description: 'Tags associated with this task',
    example: []
  }),
  createdAt: z.iso.datetime().openapi({
    description: 'Timestamp when the task was created',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.iso.datetime().openapi({
    description: 'Timestamp when the task was last updated',
    example: '2024-01-01T15:30:00.000Z'
  })
}).openapi('Task')

// Create task input model
export const CreateTaskModel = z.object({
  title: z.string().min(1, 'Title is required').max(200).openapi({
    description: 'Title of the task',
    example: 'Complete project documentation'
  }),
  description: z.string().optional().default('').openapi({
    description: 'Detailed description of the task',
    example: 'Write comprehensive documentation for the API endpoints'
  }),
  dueDate: z.iso.datetime().optional().openapi({
    description: 'Due date for the task in ISO 8601 format',
    example: '2024-12-31T23:59:59.000Z'
  }),
  startAt: z.iso.datetime().optional().openapi({
    description: 'Start date for the task in ISO 8601 format',
    example: '2024-01-01T09:00:00.000Z'
  }),
  endAt: z.iso.datetime().optional().openapi({
    description: 'End date for the task in ISO 8601 format',
    example: '2024-01-01T17:00:00.000Z'
  }),
  completedAt: z.iso.datetime().optional().nullable().openapi({
    description: 'Completion timestamp. Use null to mark the task as incomplete',
    example: '2024-01-02T08:00:00.000Z'
  }),
  tagIds: z.array(UUIDSchema).optional().openapi({
    description: 'Array of tag IDs to associate with the task',
    example: []
  })
}).refine(
  (data) => {
    if (data.startAt && data.endAt) {
      return new Date(data.startAt) <= new Date(data.endAt)
    }
    return true
  },
  { message: 'Start time must be before or equal to end time', path: ['endAt'] }
).openapi('CreateTask')

// Update task input model
export const UpdateTaskModel = z.object({
  title: z.string().min(1).max(200).optional().openapi({
    description: 'Title of the task',
    example: 'Complete project documentation'
  }),
  description: z.string().optional().openapi({
    description: 'Detailed description of the task',
    example: 'Write comprehensive documentation for the API endpoints'
  }),
  dueDate: z.iso.datetime().optional().nullable().openapi({
    description: 'Due date for the task in ISO 8601 format. Use null to remove due date',
    example: '2024-12-31T23:59:59.000Z'
  }),
  startAt: z.iso.datetime().optional().nullable().openapi({
    description: 'Start date for the task in ISO 8601 format. Use null to remove start date',
    example: '2024-01-01T09:00:00.000Z'
  }),
  endAt: z.iso.datetime().optional().nullable().openapi({
    description: 'End date for the task in ISO 8601 format. Use null to remove end date',
    example: '2024-01-01T17:00:00.000Z'
  }),
  completedAt: z.iso.datetime().optional().nullable().openapi({
    description: 'Completion timestamp. Use null to mark the task as incomplete',
    example: '2024-01-02T08:00:00.000Z'
  }),
  tagIds: z.array(UUIDSchema).optional().openapi({
    description: 'Array of tag IDs to associate with the task. Replaces all existing tags',
    example: []
  })
}).refine(
  (data) => {
    if (data.startAt && data.endAt) {
      return new Date(data.startAt) <= new Date(data.endAt)
    }
    return true
  },
  { message: 'Start time must be before or equal to end time', path: ['endAt'] }
).openapi('UpdateTask')

// Task list response model
export const TaskListResponseModel = z.object({
  tasks: z.array(TaskModel).openapi({
    description: 'List of tasks'
  }),
  total: z.number().int().min(0).openapi({
    description: 'Total number of tasks',
    example: 5
  })
}).openapi('TaskListResponse')

// Single task response model
export const TaskResponseModel = z.object({
  task: TaskModel
}).openapi('TaskResponse')

// Task query parameters (removed status filter)
// A boolean query param parser that correctly interprets the strings "true" and "false"
const BooleanQueryParam = z.enum(['true', 'false']).transform(v => v === 'true')

export const TaskQueryParamsModel = z.object({
  completed: BooleanQueryParam.optional().openapi({
    description: 'Filter tasks by completion status',
    example: false
  }),
  hasActiveTimer: BooleanQueryParam.optional().openapi({
    description: 'Filter tasks by whether they have an active timer running',
    example: true
  }),
  scheduled: BooleanQueryParam.optional().openapi({
    description: 'Filter tasks by whether they have a scheduled start time (startAt). true = only scheduled tasks, false = only unscheduled tasks. When false is combined with startAtFrom/startAtTo, uses OR logic: shows tasks in the date range OR unscheduled tasks',
    example: true
  }),
  startAtFrom: z.iso.datetime().optional().openapi({
    description: 'Filter tasks with startAt >= this timestamp (inclusive). When combined with scheduled=false, uses OR logic to also include unscheduled tasks',
    example: '2024-01-01T00:00:00.000Z'
  }),
  startAtTo: z.iso.datetime().optional().openapi({
    description: 'Filter tasks with startAt < this timestamp (exclusive). When combined with scheduled=false, uses OR logic to also include unscheduled tasks',
    example: '2024-01-02T00:00:00.000Z'
  }),
  sortBy: z.enum(['createdAt', 'startAt', 'dueDate']).optional().openapi({
    description: 'Sort tasks by field (createdAt, startAt, or dueDate)',
    example: 'startAt'
  }),
  order: z.enum(['asc', 'desc']).optional().openapi({
    description: 'Sort order: asc (ascending/oldest first) or desc (descending/newest first). Defaults to desc',
    example: 'asc'
  }),
  tags: z.preprocess((value) => {
    if (typeof value === 'string') {
      return value.includes(',') ? value.split(',').map((item) => item.trim()) : [value]
    }
    return value
  }, z.array(z.string()).optional()).openapi({
    description: 'Filter tasks by tag IDs (comma-separated). Returns tasks with ANY of the specified tags (OR logic)',
    example: '01234567-89ab-cdef-0123-456789abcdef,98765432-10ab-cdef-0123-456789abcdef'
  })
}).openapi('TaskQueryParams')

// Path parameter models
export const TaskIdParamModel = z.object({
  id: UUIDSchema.openapi({
    description: 'Task ID',
    param: {
      name: 'id',
      in: 'path'
    }
  })
}).openapi('TaskIdParam')

// Export types
export type Task = z.infer<typeof TaskModel>
export type CreateTask = z.infer<typeof CreateTaskModel>
export type UpdateTask = z.infer<typeof UpdateTaskModel>
export type TaskListResponse = z.infer<typeof TaskListResponseModel>
export type TaskResponse = z.infer<typeof TaskResponseModel>
export type TaskQueryParams = z.infer<typeof TaskQueryParamsModel>
export type TaskIdParam = z.infer<typeof TaskIdParamModel>
