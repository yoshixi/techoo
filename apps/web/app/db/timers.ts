import { eq, and, desc } from 'drizzle-orm'

import { taskTimersTable, tasksTable, type InsertTaskTimer, type SelectTaskTimer } from './schema/schema'
import type { TaskTimer, CreateTimer, UpdateTimer } from '../core/timers.core'
import { createId, type DB } from './common'

// Convert database timer to API timer
export function convertDbTimerToApi(dbTimer: SelectTaskTimer): TaskTimer {
  return {
    id: dbTimer.id.toString(),
    taskId: dbTimer.taskId.toString(),
    startTime: new Date(dbTimer.startTime * 1000).toISOString(),
    endTime: dbTimer.endTime ? new Date(dbTimer.endTime * 1000).toISOString() : undefined,
    createdAt: new Date(dbTimer.createdAt * 1000).toISOString(),
    updatedAt: new Date(dbTimer.updatedAt * 1000).toISOString()
  }
}

// Timer database functions
export async function getAllTimers(db: DB): Promise<TaskTimer[]> {
  const dbTimers = await db
    .select()
    .from(taskTimersTable)
    .orderBy(desc(taskTimersTable.createdAt))

  return dbTimers.map(convertDbTimerToApi)
}

export async function getTimersByTaskId(db: DB, userId: string, taskId: string): Promise<TaskTimer[] | null> {
  // Check if task exists and belongs to user
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!task) {
    return null
  }

  const dbTimers = await db
    .select()
    .from(taskTimersTable)
    .where(eq(taskTimersTable.taskId, taskId))
    .orderBy(desc(taskTimersTable.createdAt))

  return dbTimers.map(convertDbTimerToApi)
}

export async function getTimerById(db: DB, timerId: string): Promise<TaskTimer | null> {
  const [dbTimer] = await db
    .select()
    .from(taskTimersTable)
    .where(eq(taskTimersTable.id, timerId))

  if (!dbTimer) {
    return null
  }

  return convertDbTimerToApi(dbTimer)
}

export async function createTimer(db: DB, userId: string, data: CreateTimer): Promise<TaskTimer | null> {
  // Check if task exists and belongs to user
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, data.taskId), eq(tasksTable.userId, userId)))

  if (!task) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const timerData: InsertTaskTimer = {
    id: createId(),
    taskId: data.taskId,
    startTime: Math.floor(new Date(data.startTime).getTime() / 1000),
    createdAt: now,
    updatedAt: now
  }

  const result = await db.insert(taskTimersTable).values(timerData).returning()
  const dbTimer = result[0]
  if (!dbTimer) {
    throw new Error('Failed to create timer')
  }
  return convertDbTimerToApi(dbTimer)
}

export async function updateTimer(db: DB, timerId: string, data: UpdateTimer): Promise<TaskTimer | null> {
  const [existingTimer] = await db
    .select()
    .from(taskTimersTable)
    .where(eq(taskTimersTable.id, timerId))

  if (!existingTimer) {
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const updateData: Partial<InsertTaskTimer> = {
    updatedAt: now
  }

  if (data.endTime !== undefined) {
    updateData.endTime = data.endTime ? Math.floor(new Date(data.endTime).getTime() / 1000) : null
  }

  const result = await db
    .update(taskTimersTable)
    .set(updateData)
    .where(eq(taskTimersTable.id, timerId))
    .returning()

  const updatedDbTimer = result[0]
  if (!updatedDbTimer) {
    return null
  }

  return convertDbTimerToApi(updatedDbTimer)
}

export async function deleteTimer(db: DB, timerId: string): Promise<TaskTimer | null> {
  const [existingTimer] = await db
    .select()
    .from(taskTimersTable)
    .where(eq(taskTimersTable.id, timerId))

  if (!existingTimer) {
    return null
  }

  const result = await db
    .delete(taskTimersTable)
    .where(eq(taskTimersTable.id, timerId))
    .returning()

  const deletedTimer = result[0]
  if (!deletedTimer) {
    return null
  }

  return convertDbTimerToApi(deletedTimer)
}
