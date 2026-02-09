import { eq, and, desc, inArray, isNull } from 'drizzle-orm'
import { taskTimersTable, tasksTable, type InsertTaskTimer, type SelectTaskTimer } from '../db/schema/schema'
import { type DB } from './common.db'
import { formatTimestamp, parseISOToUnixTimestamp, getCurrentUnixTimestamp } from './common.core'

// Define API types without zod dependencies
export interface TaskTimer {
  id: number
  taskId: number
  startTime: string
  endTime: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTimer {
  taskId: number
  startTime: string
}

export interface UpdateTimer {
  startTime?: string
  endTime?: string | null
}

// Convert database timer to API timer
export function convertDbTimerToApi(dbTimer: SelectTaskTimer): TaskTimer {
  return {
    id: dbTimer.id,
    taskId: dbTimer.taskId,
    startTime: formatTimestamp(dbTimer.startTime),
    endTime: dbTimer.endTime ? formatTimestamp(dbTimer.endTime) : null,
    createdAt: formatTimestamp(dbTimer.createdAt),
    updatedAt: formatTimestamp(dbTimer.updatedAt)
  }
}

// Timer database functions
export async function getAllTimers(db: DB, userId: number): Promise<TaskTimer[]> {
  const dbTimers = await db
    .select({ timer: taskTimersTable })
    .from(taskTimersTable)
    .innerJoin(tasksTable, eq(taskTimersTable.taskId, tasksTable.id))
    .where(eq(tasksTable.userId, userId))
    .orderBy(desc(taskTimersTable.createdAt))

  return dbTimers.map(r => convertDbTimerToApi(r.timer))
}

export async function getAllTimersByTaskIds(db: DB, userId: number, taskIds: number[]): Promise<TaskTimer[]> {
  if (taskIds.length === 0) return []

  const uniqueIds = Array.from(new Set(taskIds))
  const dbTimers = await db
    .select({ timer: taskTimersTable })
    .from(taskTimersTable)
    .innerJoin(tasksTable, eq(taskTimersTable.taskId, tasksTable.id))
    .where(and(eq(tasksTable.userId, userId), inArray(taskTimersTable.taskId, uniqueIds)))
    .orderBy(desc(taskTimersTable.createdAt))

  return dbTimers.map(r => convertDbTimerToApi(r.timer))
}

export async function getTimersByTaskId(db: DB, userId: number, taskId: number): Promise<TaskTimer[] | null> {
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

export async function getTimerById(db: DB, userId: number, timerId: number): Promise<TaskTimer | null> {
  const [result] = await db
    .select({ timer: taskTimersTable })
    .from(taskTimersTable)
    .innerJoin(tasksTable, eq(taskTimersTable.taskId, tasksTable.id))
    .where(and(eq(taskTimersTable.id, timerId), eq(tasksTable.userId, userId)))

  if (!result) {
    return null
  }

  return convertDbTimerToApi(result.timer)
}

export async function createTimer(db: DB, userId: number, data: CreateTimer): Promise<TaskTimer | null> {
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

export async function updateTimer(db: DB, userId: number, timerId: number, data: UpdateTimer): Promise<TaskTimer | null> {
  // Verify timer exists and belongs to user via task ownership
  const [existing] = await db
    .select({ timer: taskTimersTable })
    .from(taskTimersTable)
    .innerJoin(tasksTable, eq(taskTimersTable.taskId, tasksTable.id))
    .where(and(eq(taskTimersTable.id, timerId), eq(tasksTable.userId, userId)))

  if (!existing) {
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

export async function stopActiveTimersForTask(db: DB, taskId: number): Promise<number> {
  const now = getCurrentUnixTimestamp()

  // Stop all active timers (endTime is null) for this task in a single update
  const result = await db
    .update(taskTimersTable)
    .set({ endTime: now, updatedAt: now })
    .where(and(eq(taskTimersTable.taskId, taskId), isNull(taskTimersTable.endTime)))
    .returning()

  return result.length
}

export async function deleteTimer(db: DB, userId: number, timerId: number): Promise<TaskTimer | null> {
  // Verify timer exists and belongs to user via task ownership
  const [existing] = await db
    .select({ timer: taskTimersTable })
    .from(taskTimersTable)
    .innerJoin(tasksTable, eq(taskTimersTable.taskId, tasksTable.id))
    .where(and(eq(taskTimersTable.id, timerId), eq(tasksTable.userId, userId)))

  if (!existing) {
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
