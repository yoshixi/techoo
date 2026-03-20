import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { listEventsRoute, getEventRoute } from '../routes/events'
import { getAllEvents, getEventById } from '../../../core/events.db'

// GET /events - List calendar events with optional filters
export const listEventsHandler: RouteHandler<typeof listEventsRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const query = c.req.valid('query')

    const events = await getAllEvents(db, user.id, {
      calendarId: query.calendarId,
      startDate: query.startDate,
      endDate: query.endDate
    })

    return c.json({ events, total: events.length }, 200)
  } catch (error) {
    console.error('Error listing events:', error)
    return c.json({ error: 'Failed to retrieve events' }, 500)
  }
}

// GET /events/{id} - Get a specific event
export const getEventHandler: RouteHandler<typeof getEventRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')

    const event = await getEventById(db, user.id, id)

    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }

    return c.json({ event }, 200)
  } catch (error) {
    console.error('Error getting event:', error)
    return c.json({ error: 'Failed to retrieve event' }, 500)
  }
}
