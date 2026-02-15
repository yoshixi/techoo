import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  listTaskCommentsRoute,
  createTaskCommentRoute,
  getTaskCommentRoute,
  updateTaskCommentRoute,
  deleteTaskCommentRoute
} from '../routes/comments'
import { getDb } from '../../../core/common.db'
import {
  getCommentsByTaskId,
  createComment,
  getCommentById,
  updateComment,
  deleteComment
} from '../../../core/comments.db'

export const listTaskCommentsHandler: RouteHandler<typeof listTaskCommentsRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { taskId } = c.req.valid('param')

    const comments = await getCommentsByTaskId(db, user.id, taskId)
    if (!comments) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json(
      {
        comments,
        total: comments.length
      },
      200
    )
  } catch (error) {
    console.error('Error listing comments:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to list comments'
      },
      500
    )
  }
}

export const createTaskCommentHandler: RouteHandler<typeof createTaskCommentRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { taskId } = c.req.valid('param')
    const data = c.req.valid('json')

    const comment = await createComment(db, user.id, { taskId, body: data.body })
    if (!comment) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json({ comment }, 201)
  } catch (error) {
    console.error('Error creating comment:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to create comment'
      },
      500
    )
  }
}

export const getTaskCommentHandler: RouteHandler<typeof getTaskCommentRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { taskId, commentId } = c.req.valid('param')

    const comment = await getCommentById(db, user.id, taskId, commentId)
    if (!comment) {
      return c.json(
        {
          error: 'Not found',
          message: 'Comment not found'
        },
        404
      )
    }

    return c.json({ comment }, 200)
  } catch (error) {
    console.error('Error fetching comment:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch comment'
      },
      500
    )
  }
}

export const updateTaskCommentHandler: RouteHandler<typeof updateTaskCommentRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { taskId, commentId } = c.req.valid('param')
    const data = c.req.valid('json')

    const comment = await updateComment(db, user.id, taskId, commentId, data)
    if (!comment) {
      return c.json(
        {
          error: 'Not found',
          message: 'Comment not found'
        },
        404
      )
    }

    return c.json({ comment }, 200)
  } catch (error) {
    console.error('Error updating comment:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to update comment'
      },
      500
    )
  }
}

export const deleteTaskCommentHandler: RouteHandler<typeof deleteTaskCommentRoute, AppBindings> = async (c) => {
  try {
    const db = getDb({ d1: c.env.DB })
    const user = c.get('user')
    const { taskId, commentId } = c.req.valid('param')

    const comment = await deleteComment(db, user.id, taskId, commentId)
    if (!comment) {
      return c.json(
        {
          error: 'Not found',
          message: 'Comment not found'
        },
        404
      )
    }

    return c.json({ comment }, 200)
  } catch (error) {
    console.error('Error deleting comment:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete comment'
      },
      500
    )
  }
}
