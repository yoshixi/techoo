import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import {
  calendarEventsTable,
  calendarsTable,
  type InsertCalendarEvent,
  type SelectCalendarEvent
} from '../db/schema/schema'
import { type DB } from './common.db'
import { formatTimestamp, getCurrentUnixTimestamp, parseISOToUnixTimestamp } from './common.core'
import type { ProviderType } from './oauth.core'
import type { CalendarEvent } from './events.core'
import type { ProviderEvent } from './calendar-providers/types'

// Convert database event to API event
export function convertDbEventToApi(dbEvent: SelectCalendarEvent): CalendarEvent {
  return {
    id: dbEvent.id.toString(),
    calendarId: dbEvent.calendarId.toString(),
    providerType: dbEvent.providerType as ProviderType,
    providerEventId: dbEvent.providerEventId,
    title: dbEvent.title,
    description: dbEvent.description,
    startAt: formatTimestamp(dbEvent.startAt),
    endAt: formatTimestamp(dbEvent.endAt),
    isAllDay: dbEvent.isAllDay === 1,
    location: dbEvent.location,
    createdAt: formatTimestamp(dbEvent.createdAt),
    updatedAt: formatTimestamp(dbEvent.updatedAt)
  }
}

// Query parameters for listing events
export interface EventQueryParams {
  calendarId?: number
  startDate?: string // ISO datetime string
  endDate?: string // ISO datetime string
}

// Get all events for a user with optional filters
export async function getAllEvents(
  db: DB,
  userId: number,
  params?: EventQueryParams
): Promise<CalendarEvent[]> {
  // Get user's calendar IDs first
  const userCalendars = await db
    .select({ id: calendarsTable.id })
    .from(calendarsTable)
    .where(eq(calendarsTable.userId, userId))

  if (userCalendars.length === 0) {
    return []
  }

  const calendarIds = userCalendars.map((c) => c.id)

  // Build conditions array
  const conditions: ReturnType<typeof eq>[] = []

  // Filter by user's calendars
  if (params?.calendarId) {
    // If specific calendar requested, verify it belongs to user
    if (!calendarIds.includes(params.calendarId)) {
      return []
    }
    conditions.push(eq(calendarEventsTable.calendarId, params.calendarId))
  } else {
    conditions.push(inArray(calendarEventsTable.calendarId, calendarIds))
  }

  // Date range filters
  if (params?.startDate) {
    const startTimestamp = parseISOToUnixTimestamp(params.startDate)
    conditions.push(gte(calendarEventsTable.endAt, startTimestamp))
  }

  if (params?.endDate) {
    const endTimestamp = parseISOToUnixTimestamp(params.endDate)
    conditions.push(lte(calendarEventsTable.startAt, endTimestamp))
  }

  const dbEvents = await db
    .select()
    .from(calendarEventsTable)
    .where(and(...conditions))
    .orderBy(calendarEventsTable.startAt)

  return dbEvents.map(convertDbEventToApi)
}

// Get event by ID
export async function getEventById(
  db: DB,
  userId: number,
  eventId: number
): Promise<CalendarEvent | null> {
  // Get user's calendar IDs
  const userCalendars = await db
    .select({ id: calendarsTable.id })
    .from(calendarsTable)
    .where(eq(calendarsTable.userId, userId))

  if (userCalendars.length === 0) {
    return null
  }

  const calendarIds = userCalendars.map((c) => c.id)

  const [dbEvent] = await db
    .select()
    .from(calendarEventsTable)
    .where(
      and(
        eq(calendarEventsTable.id, eventId),
        inArray(calendarEventsTable.calendarId, calendarIds)
      )
    )

  if (!dbEvent) return null
  return convertDbEventToApi(dbEvent)
}

// Batch import events for a calendar (full replace strategy)
export async function importEventsForCalendar(
  db: DB,
  calendarId: number,
  providerType: ProviderType,
  events: ProviderEvent[]
): Promise<number> {
  const now = getCurrentUnixTimestamp()

  // Delete all existing events for this calendar (full replace)
  await db
    .delete(calendarEventsTable)
    .where(eq(calendarEventsTable.calendarId, calendarId))

  if (events.length === 0) {
    return 0
  }

  // Prepare event data for batch insert (id is auto-incremented)
  const eventData: Omit<InsertCalendarEvent, 'id'>[] = events.map((event) => ({
    calendarId,
    providerType,
    providerEventId: event.providerEventId,
    title: event.title,
    description: event.description || null,
    startAt: event.startAt,
    endAt: event.endAt,
    isAllDay: event.isAllDay ? 1 : 0,
    location: event.location || null,
    createdAt: now,
    updatedAt: now
  }))

  // Insert in batches to avoid SQLite limits
  const batchSize = 100
  for (let i = 0; i < eventData.length; i += batchSize) {
    const batch = eventData.slice(i, i + batchSize)
    await db.insert(calendarEventsTable).values(batch)
  }

  return events.length
}

// Delete all events for a calendar
export async function deleteEventsForCalendar(
  db: DB,
  calendarId: number
): Promise<number> {
  const result = await db
    .delete(calendarEventsTable)
    .where(eq(calendarEventsTable.calendarId, calendarId))
    .returning()

  return result.length
}

// Get events count for a calendar
export async function getEventsCountForCalendar(
  db: DB,
  calendarId: number
): Promise<number> {
  const result = await db
    .select()
    .from(calendarEventsTable)
    .where(eq(calendarEventsTable.calendarId, calendarId))

  return result.length
}
