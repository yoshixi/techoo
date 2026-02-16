import { eq, and } from 'drizzle-orm'
import { calendarsTable, type InsertCalendar, type SelectCalendar } from '../db/schema/schema'
import { type DB } from './common.db'
import { formatTimestamp, getCurrentTimestamp } from './common.core'
import type { ProviderType } from './oauth.core'
import type { Calendar, CreateCalendar, UpdateCalendar } from './calendars.core'

// Convert database calendar to API calendar
export function convertDbCalendarToApi(dbCalendar: SelectCalendar): Calendar {
  return {
    id: dbCalendar.id.toString(),
    userId: dbCalendar.userId.toString(),
    providerType: dbCalendar.providerType as ProviderType,
    providerCalendarId: dbCalendar.providerCalendarId,
    name: dbCalendar.name,
    color: dbCalendar.color,
    isEnabled: dbCalendar.isEnabled === 1,
    lastSyncedAt: dbCalendar.lastSyncedAt
      ? formatTimestamp(dbCalendar.lastSyncedAt)
      : null,
    createdAt: formatTimestamp(dbCalendar.createdAt),
    updatedAt: formatTimestamp(dbCalendar.updatedAt)
  }
}

// Get all calendars for a user
export async function getAllCalendars(
  db: DB,
  userId: number,
  providerType?: ProviderType
): Promise<Calendar[]> {
  let query = db.select().from(calendarsTable)

  if (providerType) {
    const dbCalendars = await query.where(
      and(
        eq(calendarsTable.userId, userId),
        eq(calendarsTable.providerType, providerType)
      )
    )
    return dbCalendars.map(convertDbCalendarToApi)
  }

  const dbCalendars = await query.where(eq(calendarsTable.userId, userId))
  return dbCalendars.map(convertDbCalendarToApi)
}

// Get all enabled calendars for a user
export async function getEnabledCalendars(
  db: DB,
  userId: number,
  providerType?: ProviderType
): Promise<Calendar[]> {
  if (providerType) {
    const dbCalendars = await db
      .select()
      .from(calendarsTable)
      .where(
        and(
          eq(calendarsTable.userId, userId),
          eq(calendarsTable.providerType, providerType),
          eq(calendarsTable.isEnabled, 1)
        )
      )
    return dbCalendars.map(convertDbCalendarToApi)
  }

  const dbCalendars = await db
    .select()
    .from(calendarsTable)
    .where(
      and(eq(calendarsTable.userId, userId), eq(calendarsTable.isEnabled, 1))
    )
  return dbCalendars.map(convertDbCalendarToApi)
}

// Get calendar by ID
export async function getCalendarById(
  db: DB,
  userId: number,
  calendarId: number
): Promise<Calendar | null> {
  const [dbCalendar] = await db
    .select()
    .from(calendarsTable)
    .where(
      and(eq(calendarsTable.id, calendarId), eq(calendarsTable.userId, userId))
    )

  if (!dbCalendar) return null
  return convertDbCalendarToApi(dbCalendar)
}

// Get calendar by provider calendar ID
export async function getCalendarByProviderId(
  db: DB,
  userId: number,
  providerType: ProviderType,
  providerCalendarId: string
): Promise<Calendar | null> {
  const [dbCalendar] = await db
    .select()
    .from(calendarsTable)
    .where(
      and(
        eq(calendarsTable.userId, userId),
        eq(calendarsTable.providerType, providerType),
        eq(calendarsTable.providerCalendarId, providerCalendarId)
      )
    )

  if (!dbCalendar) return null
  return convertDbCalendarToApi(dbCalendar)
}

// Create a calendar
export async function createCalendar(
  db: DB,
  userId: number,
  providerType: ProviderType,
  data: CreateCalendar,
  providerName: string,
  providerColor?: string
): Promise<Calendar> {
  const now = getCurrentTimestamp()

  // id is auto-incremented
  const calendarData: Omit<InsertCalendar, 'id'> = {
    userId,
    providerType,
    providerCalendarId: data.providerCalendarId,
    name: data.name || providerName,
    color: providerColor || null,
    isEnabled: data.isEnabled !== false ? 1 : 0,
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now
  }

  const [dbCalendar] = await db
    .insert(calendarsTable)
    .values(calendarData)
    .returning()

  if (!dbCalendar) {
    throw new Error('Failed to create calendar')
  }

  return convertDbCalendarToApi(dbCalendar)
}

// Update a calendar
export async function updateCalendar(
  db: DB,
  userId: number,
  calendarId: number,
  data: UpdateCalendar
): Promise<Calendar | null> {
  const [existingCalendar] = await db
    .select()
    .from(calendarsTable)
    .where(
      and(eq(calendarsTable.id, calendarId), eq(calendarsTable.userId, userId))
    )

  if (!existingCalendar) return null

  const now = getCurrentTimestamp()
  const updateData: Partial<InsertCalendar> = {
    updatedAt: now
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled ? 1 : 0

  const [updatedCalendar] = await db
    .update(calendarsTable)
    .set(updateData)
    .where(eq(calendarsTable.id, calendarId))
    .returning()

  if (!updatedCalendar) return null
  return convertDbCalendarToApi(updatedCalendar)
}

// Update lastSyncedAt timestamp
export async function updateCalendarLastSynced(
  db: DB,
  calendarId: number
): Promise<void> {
  const now = getCurrentTimestamp()
  await db
    .update(calendarsTable)
    .set({ lastSyncedAt: now, updatedAt: now })
    .where(eq(calendarsTable.id, calendarId))
}

// Delete a calendar
export async function deleteCalendar(
  db: DB,
  userId: number,
  calendarId: number
): Promise<Calendar | null> {
  const [existingCalendar] = await db
    .select()
    .from(calendarsTable)
    .where(
      and(eq(calendarsTable.id, calendarId), eq(calendarsTable.userId, userId))
    )

  if (!existingCalendar) return null

  const [deletedCalendar] = await db
    .delete(calendarsTable)
    .where(eq(calendarsTable.id, calendarId))
    .returning()

  if (!deletedCalendar) return null
  return convertDbCalendarToApi(deletedCalendar)
}

// Delete all calendars for a user and provider
export async function deleteAllCalendarsForProvider(
  db: DB,
  userId: number,
  providerType: ProviderType
): Promise<number> {
  const result = await db
    .delete(calendarsTable)
    .where(
      and(
        eq(calendarsTable.userId, userId),
        eq(calendarsTable.providerType, providerType)
      )
    )
    .returning()

  return result.length
}

// Get calendar by ID only (without user constraint, for webhooks)
export async function getCalendarByIdOnly(
  db: DB,
  calendarId: number
): Promise<Calendar | null> {
  const [dbCalendar] = await db
    .select()
    .from(calendarsTable)
    .where(eq(calendarsTable.id, calendarId))

  if (!dbCalendar) return null
  return convertDbCalendarToApi(dbCalendar)
}

// Get user ID by calendar ID (for webhooks)
export async function getUserIdByCalendarId(
  db: DB,
  calendarId: number
): Promise<number | null> {
  const [calendar] = await db
    .select({ userId: calendarsTable.userId })
    .from(calendarsTable)
    .where(eq(calendarsTable.id, calendarId))

  if (!calendar) return null
  return calendar.userId
}
