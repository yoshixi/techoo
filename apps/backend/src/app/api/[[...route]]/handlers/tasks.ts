import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  listTasksRoute,
  getTaskRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute
} from '../routes/tasks'
import { getAllTasks, getTaskById, createTask, updateTask, deleteTask } from '../../../core/tasks.db'

// Task handlers
export const listTasksHandler: RouteHandler<typeof listTasksRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    // Validate and extract query parameters using the TaskQueryParamsModel schema
    const { ids, completed, hasActiveTimer, scheduled, startAtFrom, startAtTo, sortBy, order, nullsLast, tags } = c.req.valid('query')

    const tasks = await getAllTasks(db, user.id, { ids, completed, hasActiveTimer, scheduled, startAtFrom, startAtTo, sortBy, order, nullsLast, tags })

    return c.json(
      {
        tasks: tasks,
        total: tasks.length
      },
      200
    )
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to fetch tasks')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch tasks'
      },
      500
    )
  }
}

export const getTaskHandler: RouteHandler<typeof getTaskRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const task = await getTaskById(db, user.id, id)

    if (!task) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json({ task }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to fetch task')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch task'
      },
      500
    )
  }
}

export const createTaskHandler: RouteHandler<typeof createTaskRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const data = c.req.valid('json')

    const task = await createTask(db, user.id, data)

    return c.json({ task }, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to create task')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to create task'
      },
      500
    )
  }
}

export const updateTaskHandler: RouteHandler<typeof updateTaskRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const task = await updateTask(db, user.id, id, data)

    if (!task) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json({ task }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to update task')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to update task'
      },
      500
    )
  }
}

export const deleteTaskHandler: RouteHandler<typeof deleteTaskRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const task = await deleteTask(db, user.id, id)

    if (!task) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json({ task }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to delete task')
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete task'
      },
      500
    )
  }
}
