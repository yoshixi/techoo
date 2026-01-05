import { eq, and, desc } from 'drizzle-orm'
import { tasksTable, usersTable, type InsertTask, type SelectTask, type SelectUser } from '../db/schema/schema'
import { createId, type DB } from './common.db'
import { formatTimestamp, parseISOToUnixTimestamp, getCurrentUnixTimestamp, validateRequiredString } from './common.core'

// Define API types without zod dependencies
export interface Task {
  id: string
  title: string
  description: string
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTask {
  title: string
  description?: string
  dueDate?: string
}

export interface UpdateTask {
  title?: string
  description?: string
  dueDate?: string | null
}

// Convert database task to API task
export function convertDbTaskToApi(dbTask: SelectTask): Task {
  return {
    id: dbTask.id.toString(),
    title: dbTask.title,
    description: dbTask.description || '',
    dueDate: dbTask.dueAt ? formatTimestamp(dbTask.dueAt) : null,
    createdAt: formatTimestamp(dbTask.createdAt),
    updatedAt: formatTimestamp(dbTask.updatedAt)
  }
}

// Task database functions
export async function ensureDefaultUser(db: DB): Promise<SelectUser> {
  const existingUsers = await db.select().from(usersTable).limit(1)

  if (existingUsers.length === 0) {
    const result = await db.insert(usersTable).values({
      id: createId(),
      name: 'Default User'
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

export async function getAllTasks(db: DB, userId: string): Promise<Task[]> {
  const dbTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId))
    .orderBy(desc(tasksTable.createdAt))

  return dbTasks.map(convertDbTaskToApi)
}

export async function getTaskById(db: DB, userId: string, taskId: string): Promise<Task | null> {
  const [dbTask] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!dbTask) {
    return null
  }

  return convertDbTaskToApi(dbTask)
}

export async function createTask(db: DB, userId: string, data: CreateTask): Promise<Task> {
  const now = getCurrentUnixTimestamp()
  const taskData: InsertTask = {
    id: createId(),
    userId: userId,
    title: validateRequiredString(data.title, 'Title'),
    description: data.description?.trim() || null,
    dueAt: data.dueDate ? parseISOToUnixTimestamp(data.dueDate) : null,
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

export async function updateTask(db: DB, userId: string, taskId: string, data: UpdateTask): Promise<Task | null> {
  // Check if task exists
  const [existingTask] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!existingTask) {
    return null
  }

  const now = getCurrentUnixTimestamp()
  const updateData: Partial<InsertTask> = {
    updatedAt: now
  }

  if (data.title !== undefined) updateData.title = validateRequiredString(data.title, 'Title')
  if (data.description !== undefined) updateData.description = data.description.trim() || null
  if (data.dueDate !== undefined) updateData.dueAt = data.dueDate ? parseISOToUnixTimestamp(data.dueDate) : null

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

export async function deleteTask(db: DB, userId: string, taskId: string): Promise<Task | null> {
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
