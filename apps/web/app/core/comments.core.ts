import { z } from '@hono/zod-openapi'
import { IdSchema } from './common.core'

export const TaskCommentModel = z.object({
  id: IdSchema.openapi({
    description: 'Unique identifier for the comment'
  }),
  taskId: IdSchema.openapi({
    description: 'Task ID associated with this comment'
  }),
  authorId: IdSchema.openapi({
    description: 'Author (user) ID of the comment'
  }),
  body: z.string().min(1).max(2000).openapi({
    description: 'Comment text content (1-2000 chars)',
    example: 'Wrapped up pomodoro #1, still need to draft summary.'
  }),
  createdAt: z.iso.datetime().openapi({
    description: 'Timestamp when the comment was created'
  }),
  updatedAt: z.iso.datetime().openapi({
    description: 'Timestamp when the comment was last updated'
  })
}).openapi('TaskComment')

export const CreateCommentModel = z.object({
  body: z.string().min(1).max(2000).openapi({
    description: 'Comment text (1-2000 chars)',
    example: 'Summarized what happened during today’s session.'
  })
}).openapi('CreateTaskComment')

export const UpdateCommentModel = z.object({
  body: z.string().min(1).max(2000).optional().openapi({
    description: 'Updated comment text (1-2000 chars)'
  })
}).openapi('UpdateTaskComment')

export const TaskCommentListResponseModel = z.object({
  comments: z.array(TaskCommentModel).openapi({
    description: 'List of task comments'
  }),
  total: z.number().int().min(0).openapi({
    description: 'Total number of comments returned'
  })
}).openapi('TaskCommentListResponse')

export const TaskCommentResponseModel = z.object({
  comment: TaskCommentModel
}).openapi('TaskCommentResponse')

export const TaskIdForCommentsParamModel = z.object({
  taskId: IdSchema.openapi({
    description: 'Task ID for comment operations',
    param: {
      name: 'taskId',
      in: 'path'
    }
  })
}).openapi('TaskIdForCommentsParam')

export const CommentIdParamModel = z.object({
  commentId: IdSchema.openapi({
    description: 'Comment ID',
    param: {
      name: 'commentId',
      in: 'path'
    }
  })
}).openapi('CommentIdParam')

export const TaskCommentParamModel = z.object({
  taskId: TaskIdForCommentsParamModel.shape.taskId,
  commentId: CommentIdParamModel.shape.commentId
}).openapi('TaskCommentParam')

export type TaskComment = z.infer<typeof TaskCommentModel>
export type CreateTaskComment = z.infer<typeof CreateCommentModel>
export type UpdateTaskComment = z.infer<typeof UpdateCommentModel>
export type TaskCommentListResponse = z.infer<typeof TaskCommentListResponseModel>
export type TaskCommentResponse = z.infer<typeof TaskCommentResponseModel>
export type TaskIdForCommentsParam = z.infer<typeof TaskIdForCommentsParamModel>
export type CommentIdParam = z.infer<typeof CommentIdParamModel>
export type TaskCommentParam = z.infer<typeof TaskCommentParamModel>
