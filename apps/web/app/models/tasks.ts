import { z } from '@hono/zod-openapi'
import { UUIDSchemaFinal } from './schemas'

// Enum for task status
export const TaskStatusEnum = z.enum(['To Do', 'In Progress', 'Done']).openapi({
  description: 'Status of a task',
  example: 'To Do'
})

// Base task model
export const TaskModel = z.object({
  id: UUIDSchemaFinal.openapi({
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
  status: TaskStatusEnum,
  dueDate: z.string().datetime().optional().openapi({
    description: 'Due date for the task in ISO 8601 format',
    example: '2024-12-31T23:59:59.000Z'
  }),
  createdAt: z.string().datetime().openapi({
    description: 'Timestamp when the task was created',
    example: '2024-01-01T10:00:00.000Z'
  }),
  updatedAt: z.string().datetime().openapi({
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
  dueDate: z.string().datetime().optional().openapi({
    description: 'Due date for the task in ISO 8601 format',
    example: '2024-12-31T23:59:59.000Z'
  })
}).openapi('CreateTask')

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
  status: TaskStatusEnum.optional(),
  dueDate: z.string().datetime().optional().nullable().openapi({
    description: 'Due date for the task in ISO 8601 format. Use null to remove due date',
    example: '2024-12-31T23:59:59.000Z'
  })
}).openapi('UpdateTask')

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

// Task query parameters
export const TaskQueryParamsModel = z.object({
  status: z.enum(['all', 'To Do', 'In Progress', 'Done']).optional().default('all').openapi({
    description: 'Filter tasks by status',
    example: 'To Do'
  })
}).openapi('TaskQueryParams')

// Export types
export type Task = z.infer<typeof TaskModel>
export type CreateTask = z.infer<typeof CreateTaskModel>
export type UpdateTask = z.infer<typeof UpdateTaskModel>
export type TaskListResponse = z.infer<typeof TaskListResponseModel>
export type TaskResponse = z.infer<typeof TaskResponseModel>
export type TaskQueryParams = z.infer<typeof TaskQueryParamsModel>
export type TaskStatus = z.infer<typeof TaskStatusEnum>

