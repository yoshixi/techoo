import type { RouteHandler } from '@hono/zod-openapi'
import {
  listTasksRoute,
  getTaskRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute
} from '../routes/tasks'
import { getDb } from '../../../core/common.db'
import { ensureDefaultUser, getAllTasks, getTaskById, createTask, updateTask, deleteTask } from '../../../core/tasks.db'

// Task handlers
export const listTasksHandler: RouteHandler<typeof listTasksRoute> = async (c) => {
  try {
    const db = getDb()
    const defaultUser = await ensureDefaultUser(db)
    // Validate and extract query parameters using the TaskQueryParamsModel schema
    const { completed, sortBy, order } = c.req.valid('query')

    const tasks = await getAllTasks(db, defaultUser.id.toString(), { completed, sortBy, order })

    return c.json(
      {
        tasks: tasks,
        total: tasks.length
      },
      200
    )
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch tasks'
      },
      500
    )
  }
}

export const getTaskHandler: RouteHandler<typeof getTaskRoute> = async (c) => {
  try {
    const db = getDb()
    const defaultUser = await ensureDefaultUser(db)
    const { id } = c.req.valid('param')
    
    const task = await getTaskById(db, defaultUser.id.toString(), id)
    
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
    console.error('Error fetching task:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch task'
      },
      500
    )
  }
}

export const createTaskHandler: RouteHandler<typeof createTaskRoute> = async (c) => {
  try {
    const db = getDb()
    const defaultUser = await ensureDefaultUser(db)
    const data = c.req.valid('json')
    
    const task = await createTask(db, defaultUser.id.toString(), data)
    
    return c.json({ task }, 201)
  } catch (error) {
    console.error('Error creating task:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to create task'
      },
      500
    )
  }
}

export const updateTaskHandler: RouteHandler<typeof updateTaskRoute> = async (c) => {
  try {
    const db = getDb()
    const defaultUser = await ensureDefaultUser(db)
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    
    const task = await updateTask(db, defaultUser.id.toString(), id, data)
    
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
    console.error('Error updating task:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to update task'
      },
      500
    )
  }
}

export const deleteTaskHandler: RouteHandler<typeof deleteTaskRoute> = async (c) => {
  try {
    const db = getDb()
    const defaultUser = await ensureDefaultUser(db)
    const { id } = c.req.valid('param')
    
    const task = await deleteTask(db, defaultUser.id.toString(), id)
    
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
    console.error('Error deleting task:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete task'
      },
      500
    )
  }
}
