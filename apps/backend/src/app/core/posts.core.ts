import { z } from '@hono/zod-openapi'
import { IdSchema, Rfc3339Schema, Rfc3339InputSchema } from './common.core'

// Linked event/todo summaries included in post responses
const LinkedEventModel = z.object({
  id: z.number().int(),
  title: z.string(),
})

const LinkedTodoModel = z.object({
  id: IdSchema,
  title: z.string(),
})

export const PostModel = z.object({
  id: IdSchema,
  body: z.string(),
  posted_at: Rfc3339Schema,
  events: z.array(LinkedEventModel),
  todos: z.array(LinkedTodoModel),
}).openapi('Post')

export const CreatePostModel = z.object({
  body: z.string().min(1),
  posted_at: Rfc3339InputSchema.optional().openapi({ description: 'Defaults to now if omitted' }),
  event_ids: z.array(z.number().int()).optional().default([]),
  todo_ids: z.array(IdSchema).optional().default([]),
}).openapi('CreatePost')

export const UpdatePostModel = z.object({
  body: z.string().min(1).optional(),
  event_ids: z.array(z.number().int()).optional(),
  todo_ids: z.array(IdSchema).optional(),
}).openapi('UpdatePost')

export const PostQueryParamsModel = z
  .object({
    from: Rfc3339InputSchema.optional().openapi({
      description: 'Range start (RFC3339). Use with `to` for a time window.',
    }),
    to: Rfc3339InputSchema.optional().openapi({
      description: 'Range end (RFC3339). Use with `from` for a time window.',
    }),
    limit: z.coerce.number().int().min(1).max(10000).optional().openapi({
      description:
        'Max rows: with from/to (range) caps that window (default 1000, max 10000). Without from/to (paginated feed) default 30, max 100.',
    }),
    offset: z.coerce.number().int().min(0).optional().openapi({
      description: 'Skip this many posts (newest-first order) when not using from/to.',
    }),
  })
  .superRefine((q, ctx) => {
    const hasFrom = q.from !== undefined
    const hasTo = q.to !== undefined
    if (hasFrom !== hasTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide both `from` and `to`, or neither (for paginated all-posts listing).',
        path: hasFrom ? ['to'] : ['from'],
      })
    }
    const range = hasFrom && hasTo
    const hasOffset = (q.offset ?? 0) > 0
    if (range && hasOffset) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`offset` is only for paginated listing (omit from/to). Use `limit` to cap range results.',
        path: ['offset'],
      })
    }
  })
  .openapi('PostQueryParams')

export const PostIdParamModel = z.object({
  id: IdSchema.openapi({ param: { name: 'id', in: 'path' } }),
}).openapi('PostIdParam')

export const PostListResponseModel = z
  .object({
    data: z.array(PostModel),
    /** Present when listing with limit/offset (not range mode). */
    has_more: z.boolean().optional(),
  })
  .openapi('PostListResponse')

export const PostResponseModel = z.object({
  data: PostModel,
}).openapi('PostResponse')

export type Post = z.infer<typeof PostModel>
export type CreatePost = z.infer<typeof CreatePostModel>
export type UpdatePost = z.infer<typeof UpdatePostModel>
