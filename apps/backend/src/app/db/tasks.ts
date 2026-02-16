import { eq, and, desc } from 'drizzle-orm'

import { tasksTable, usersTable, type InsertTask, type SelectTask, type SelectUser } from './schema/schema'
import type { Task, CreateTask, UpdateTask } from '../core/tasks.core'
import { type DB } from './common'
import { formatTimestamp, getCurrentTimestamp, parseISOToDate } from '../core/common.core'

// Convert database task to API task
export function convertDbTaskToApi(dbTask: SelectTask): Task {

  return {
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description || '',
    dueDate: dbTask.dueAt ? formatTimestamp(dbTask.dueAt) : undefined,
    startAt: dbTask.startAt ? formatTimestamp(dbTask.startAt) : undefined,
    endAt: dbTask.endAt ? formatTimestamp(dbTask.endAt) : undefined,
    completedAt: dbTask.completedAt ? formatTimestamp(dbTask.completedAt) : undefined,
    tags: [], // This old implementation doesn't load tags - use app/core/tasks.db.ts for full functionality
    createdAt: formatTimestamp(dbTask.createdAt),
    updatedAt: formatTimestamp(dbTask.updatedAt)
  }
}

// Task database functions
export async function ensureDefaultUser(db: DB): Promise<SelectUser> {
  const existingUsers = await db.select().from(usersTable).limit(1)

  if (existingUsers.length === 0) {
    const result = await db.insert(usersTable).values({
      name: 'Default User',
      email: 'default@example.com',
    }).returning()
    const user = result[0]
    if (!user) {
      throw new Error('Failed to create default user')
    }
    return user
  }

  const user = existingUsers[0]
  if (!user) {
    throw new Error('No user found and failed to create default user')
  }
  return user
}

export async function getAllTasks(db: DB, userId: number): Promise<Task[]> {
  const dbTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId))
    .orderBy(desc(tasksTable.createdAt))

  return dbTasks.map(convertDbTaskToApi)
}

export async function getTaskById(db: DB, userId: number, taskId: number): Promise<Task | null> {
  const [dbTask] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!dbTask) {
    return null
  }

  return convertDbTaskToApi(dbTask)
}

export async function createTask(db: DB, userId: number, data: CreateTask): Promise<Task> {
  const now = getCurrentTimestamp()
  const taskData: InsertTask = {
    userId: userId,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    dueAt: data.dueDate ? parseISOToDate(data.dueDate) : null,
    endAt: data.endAt ? parseISOToDate(data.endAt) : null,
    createdAt: now,
    updatedAt: now
  }

  const result = await db.insert(tasksTable).values(taskData).returning()
  const dbTask = result[0]
  if (!dbTask) {
    throw new Error('Failed to create task')
  }
  return convertDbTaskToApi(dbTask)
}

export async function updateTask(db: DB, userId: number, taskId: number, data: UpdateTask): Promise<Task | null> {
  // Check if task exists
  const [existingTask] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!existingTask) {
    return null
  }

  const now = getCurrentTimestamp()
  const updateData: Partial<InsertTask> = {
    updatedAt: now
  }

  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description.trim() || null
  if (data.dueDate !== undefined) updateData.dueAt = data.dueDate ? parseISOToDate(data.dueDate) : null
  if (data.endAt !== undefined) updateData.endAt = data.endAt ? parseISOToDate(data.endAt) : null

  const result = await db
    .update(tasksTable)
    .set(updateData)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning()

  const updatedDbTask = result[0]
  if (!updatedDbTask) {
    return null
  }

  return convertDbTaskToApi(updatedDbTask)
}

export async function deleteTask(db: DB, userId: number, taskId: number): Promise<Task | null> {
  const [existingTask] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!existingTask) {
    return null
  }

  // Delete task (timers will be deleted automatically due to foreign key cascade)
  const result = await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning()

  const deletedTask = result[0]
  if (!deletedTask) {
    return null
  }

  return convertDbTaskToApi(deletedTask)
}
