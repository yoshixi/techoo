import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  listTimersRoute,
  getTaskTimersRoute,
  getTimerRoute,
  createTimerRoute,
  updateTimerRoute,
  deleteTimerRoute
} from '../routes/timers'
import { getDb } from '../../../core/common.db'
import {
  getAllTimers,
  getAllTimersByTaskIds,
  getTimersByTaskId,
  getTimerById,
  createTimer,
  updateTimer,
  deleteTimer
} from '../../../core/timers.db'

// Timer handlers
export const listTimersHandler: RouteHandler<typeof listTimersRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()

    const { taskIds } = c.req.valid('query')
    if (taskIds) {
      const timers = await getAllTimersByTaskIds(db, taskIds)
      return c.json(
        {
          timers: timers,
          total: timers.length
        },
        200
      )
    }

    const timers = await getAllTimers(db)

    return c.json(
      {
        timers: timers,
        total: timers.length
      },
      200
    )
  } catch (error) {
    console.error('Error fetching timers:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch timers'
      },
      500
    )
  }
}

export const getTaskTimersHandler: RouteHandler<typeof getTaskTimersRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')
    const { taskId } = c.req.valid('param')

    const timers = await getTimersByTaskId(db, user.id, taskId)

    if (timers === null) {
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
        timers: timers,
        total: timers.length
      },
      200
    )
  } catch (error) {
    console.error('Error fetching task timers:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch task timers'
      },
      500
    )
  }
}

export const getTimerHandler: RouteHandler<typeof getTimerRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()
    const { id } = c.req.valid('param')

    const timer = await getTimerById(db, id)

    if (!timer) {
      return c.json(
        {
          error: 'Not found',
          message: 'Timer not found'
        },
        404
      )
    }

    return c.json({ timer }, 200)
  } catch (error) {
    console.error('Error fetching timer:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch timer'
      },
      500
    )
  }
}

export const createTimerHandler: RouteHandler<typeof createTimerRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')
    const data = c.req.valid('json')

    const timer = await createTimer(db, user.id, data)

    if (!timer) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json({ timer }, 201)
  } catch (error) {
    console.error('Error creating timer:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to create timer'
      },
      500
    )
  }
}

export const updateTimerHandler: RouteHandler<typeof updateTimerRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')

    const timer = await updateTimer(db, id, data)

    if (!timer) {
      return c.json(
        {
          error: 'Not found',
          message: 'Timer not found'
        },
        404
      )
    }

    return c.json({ timer }, 200)
  } catch (error) {
    console.error('Error updating timer:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to update timer'
      },
      500
    )
  }
}

export const deleteTimerHandler: RouteHandler<typeof deleteTimerRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()
    const { id } = c.req.valid('param')

    const timer = await deleteTimer(db, id)

    if (!timer) {
      return c.json(
        {
          error: 'Not found',
          message: 'Timer not found'
        },
        404
      )
    }

    return c.json({ timer }, 200)
  } catch (error) {
    console.error('Error deleting timer:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete timer'
      },
      500
    )
  }
}
