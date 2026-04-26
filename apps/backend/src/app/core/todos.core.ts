import { z } from '@hono/zod-openapi'
import { ErrorResponseModel, IdSchema, Rfc3339Schema, Rfc3339InputSchema } from './common.core'

// Todo model
export const TodoModel = z.object({
  id: IdSchema,
  title: z.string().openapi({ example: 'Reply to client email' }),
  description: z.string().nullable().optional().openapi({ description: 'Optional longer notes for this todo' }),
  starts_at: Rfc3339Schema.nullable().openapi({ description: 'Start time (nullable for unscheduled todos)' }),
  ends_at: Rfc3339Schema.nullable().openapi({ description: 'End time (nullable)' }),
  is_all_day: z.number().int().min(0).max(1).openapi({ description: '1 = all-day todo' }),
  done: z.number().int().min(0).max(1).openapi({ description: '1 = completed' }),
  done_at: Rfc3339Schema.nullable(),
  created_at: Rfc3339Schema,
}).openapi('Todo')

export const CreateTodoModel = z.object({
  title: z.string().min(1).openapi({ example: 'Reply to client email' }),
  description: z.string().nullable().optional(),
  starts_at: Rfc3339InputSchema.optional(),
  ends_at: Rfc3339InputSchema.optional(),
  is_all_day: z.number().int().min(0).max(1).optional().default(0),
}).openapi('CreateTodo')

export const UpdateTodoModel = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  starts_at: Rfc3339InputSchema.nullable().optional(),
  ends_at: Rfc3339InputSchema.nullable().optional(),
  is_all_day: z.number().int().min(0).max(1).optional(),
  done: z.number().int().min(0).max(1).optional(),
}).openapi('UpdateTodo')

export const TodoQueryParamsModel = z.object({
  from: Rfc3339InputSchema.optional().openapi({ description: 'Range start (RFC3339)' }),
  to: Rfc3339InputSchema.optional().openapi({ description: 'Range end (RFC3339)' }),
  done: z.enum(['true', 'false']).optional().openapi({ description: 'Filter by completion status' }),
  limit: z.coerce.number().int().min(1).max(500).optional().openapi({
    description: 'Max rows to return (default 100, max 500)',
  }),
}).openapi('TodoQueryParams')

export const TodoIdParamModel = z.object({
  id: IdSchema.openapi({ param: { name: 'id', in: 'path' } }),
}).openapi('TodoIdParam')

export const TodoListResponseModel = z.object({
  data: z.array(TodoModel),
}).openapi('TodoListResponse')

export const TodoResponseModel = z.object({
  data: TodoModel,
}).openapi('TodoResponse')

// Types
export type Todo = z.infer<typeof TodoModel>
export type CreateTodo = z.infer<typeof CreateTodoModel>
export type UpdateTodo = z.infer<typeof UpdateTodoModel>
