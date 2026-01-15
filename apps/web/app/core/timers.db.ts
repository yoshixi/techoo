import { eq, and, desc, inArray, isNull } from 'drizzle-orm'
import { taskTimersTable, tasksTable, type InsertTaskTimer, type SelectTaskTimer } from '../db/schema/schema'
import { createId, type DB } from './common.db'
import { formatTimestamp, parseISOToUnixTimestamp, getCurrentUnixTimestamp } from './common.core'

// Define API types without zod dependencies
export interface TaskTimer {
  id: string
  taskId: string
  startTime: string
  endTime: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTimer {
  taskId: string
  startTime: string
}

export interface UpdateTimer {
  startTime?: string
  endTime?: string | null
}

// Convert database timer to API timer
export function convertDbTimerToApi(dbTimer: SelectTaskTimer): TaskTimer {
  return {
    id: dbTimer.id.toString(),
    taskId: dbTimer.taskId.toString(),
    startTime: formatTimestamp(dbTimer.startTime),
    endTime: dbTimer.endTime ? formatTimestamp(dbTimer.endTime) : null,
    createdAt: formatTimestamp(dbTimer.createdAt),
    updatedAt: formatTimestamp(dbTimer.updatedAt)
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

export async function getAllTimersByTaskIds(db: DB, taskIds: string[]): Promise<TaskTimer[]> {
  if (taskIds.length === 0) return []

  const uniqueIds = Array.from(new Set(taskIds))
  const dbTimers = await db
    .select()
    .from(taskTimersTable)
    .where(inArray(taskTimersTable.taskId, uniqueIds))
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

  const now = getCurrentUnixTimestamp()
  const timerData: InsertTaskTimer = {
    id: createId(),
    taskId: data.taskId,
    startTime: parseISOToUnixTimestamp(data.startTime),
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

  const now = getCurrentUnixTimestamp()
  const updateData: Partial<InsertTaskTimer> = {
    updatedAt: now
  }

  if (data.startTime !== undefined) {
    updateData.startTime = parseISOToUnixTimestamp(data.startTime)
  }

  if (data.endTime !== undefined) {
    updateData.endTime = data.endTime ? parseISOToUnixTimestamp(data.endTime) : null
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

export async function stopActiveTimersForTask(db: DB, taskId: string): Promise<number> {
  const now = getCurrentUnixTimestamp()

  // Stop all active timers (endTime is null) for this task in a single update
  const result = await db
    .update(taskTimersTable)
    .set({ endTime: now, updatedAt: now })
    .where(and(eq(taskTimersTable.taskId, taskId), isNull(taskTimersTable.endTime)))
    .returning()

  return result.length
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
