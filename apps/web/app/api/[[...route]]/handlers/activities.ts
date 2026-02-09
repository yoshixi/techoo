import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { getTaskActivitiesRoute } from '../routes/activities'
import { getDb } from '../../../core/common.db'
import { getTaskActivities } from '../../../core/activities.db'

export const getTaskActivitiesHandler: RouteHandler<typeof getTaskActivitiesRoute, AppBindings> = async (c) => {
  try {
    const db = getDb()
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const activities = await getTaskActivities(db, user.id, id)
    if (!activities) {
      return c.json(
        {
          error: 'Not found',
          message: 'Task not found'
        },
        404
      )
    }

    return c.json({ activities }, 200)
  } catch (error) {
    console.error('Error fetching task activities:', error)
    return c.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch task activities'
      },
      500
    )
  }
}
