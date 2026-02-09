import { eq, and, lt, gt } from 'drizzle-orm'
import {
  calendarWatchChannelsTable,
  type InsertCalendarWatchChannel,
  type SelectCalendarWatchChannel
} from '../db/schema/schema'
import { type DB } from './common.db'
import { getCurrentUnixTimestamp } from './common.core'
import type { ProviderType } from './oauth.core'

// Create a watch channel
export async function createWatchChannel(
  db: DB,
  calendarId: number,
  providerType: ProviderType,
  channelId: string,
  resourceId: string,
  expiresAt: number,
  token?: string
): Promise<SelectCalendarWatchChannel> {
  const now = getCurrentUnixTimestamp()

  // Delete any existing channel for this calendar
  await db
    .delete(calendarWatchChannelsTable)
    .where(
      and(
        eq(calendarWatchChannelsTable.calendarId, calendarId),
        eq(calendarWatchChannelsTable.providerType, providerType)
      )
    )

  // id is auto-incremented
  const channelData: Omit<InsertCalendarWatchChannel, 'id'> = {
    calendarId,
    channelId,
    resourceId,
    providerType,
    expiresAt,
    token: token || null,
    createdAt: now,
    updatedAt: now
  }

  const [channel] = await db
    .insert(calendarWatchChannelsTable)
    .values(channelData)
    .returning()

  if (!channel) {
    throw new Error('Failed to create watch channel')
  }

  return channel
}

// Get watch channel by calendar ID
export async function getWatchChannelByCalendarId(
  db: DB,
  calendarId: number,
  providerType: ProviderType
): Promise<SelectCalendarWatchChannel | null> {
  const [channel] = await db
    .select()
    .from(calendarWatchChannelsTable)
    .where(
      and(
        eq(calendarWatchChannelsTable.calendarId, calendarId),
        eq(calendarWatchChannelsTable.providerType, providerType)
      )
    )

  return channel || null
}

// Get watch channel by channel ID (used for webhook notifications)
export async function getWatchChannelByChannelId(
  db: DB,
  channelId: string
): Promise<SelectCalendarWatchChannel | null> {
  const [channel] = await db
    .select()
    .from(calendarWatchChannelsTable)
    .where(eq(calendarWatchChannelsTable.channelId, channelId))

  return channel || null
}

// Delete watch channel
export async function deleteWatchChannel(
  db: DB,
  calendarId: number,
  providerType: ProviderType
): Promise<SelectCalendarWatchChannel | null> {
  const [channel] = await db
    .delete(calendarWatchChannelsTable)
    .where(
      and(
        eq(calendarWatchChannelsTable.calendarId, calendarId),
        eq(calendarWatchChannelsTable.providerType, providerType)
      )
    )
    .returning()

  return channel || null
}

// Get all expired watch channels
export async function getExpiredWatchChannels(
  db: DB
): Promise<SelectCalendarWatchChannel[]> {
  const now = getCurrentUnixTimestamp()

  return db
    .select()
    .from(calendarWatchChannelsTable)
    .where(lt(calendarWatchChannelsTable.expiresAt, now))
}

// Get watch channels expiring soon (within specified seconds)
export async function getExpiringWatchChannels(
  db: DB,
  withinSeconds: number = 3600 // Default 1 hour
): Promise<SelectCalendarWatchChannel[]> {
  const now = getCurrentUnixTimestamp()
  const threshold = now + withinSeconds

  return db
    .select()
    .from(calendarWatchChannelsTable)
    .where(lt(calendarWatchChannelsTable.expiresAt, threshold))
}

// Get all active watch channels
export async function getAllActiveWatchChannels(
  db: DB
): Promise<SelectCalendarWatchChannel[]> {
  const now = getCurrentUnixTimestamp()

  return db
    .select()
    .from(calendarWatchChannelsTable)
    .where(
      // Channel is still valid (not expired): expiresAt > now
      gt(calendarWatchChannelsTable.expiresAt, now)
    )
}
