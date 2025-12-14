import { eq, and, desc, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { tasksTable, taskTimersTable, usersTable, type InsertTask, type SelectTask, type InsertTaskTimer, type SelectTaskTimer, type SelectUser } from './schema/schema'
import type { Task, CreateTask, UpdateTask, TaskStatus } from '../core/tasks.core'
import { getDb, createId, type DB } from './common'

// Convert database task to API task
export function convertDbTaskToApi(dbTask: SelectTask): Task {
  let status: TaskStatus
  if (dbTask.completedAt) {
    status = 'Done'
  } else {
    status = 'To Do' // Default to "To Do", will be updated if there are active timers
  }

  return {
    id: dbTask.id.toString(),
    title: dbTask.title,
    description: dbTask.description || '',
    status,
    dueDate: dbTask.dueAt ? new Date(dbTask.dueAt * 1000).toISOString() : undefined,
    createdAt: new Date(dbTask.createdAt * 1000).toISOString(),
    updatedAt: new Date(dbTask.updatedAt * 1000).toISOString()
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

export async function getAllTasks(db: DB, userId: string, statusFilter?: string): Promise<Task[]> {
  let dbTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.userId, userId))
    .orderBy(desc(tasksTable.createdAt))

  // Get active timers to determine "In Progress" status
  const activeTimers = await db
    .select()
    .from(taskTimersTable)
    .where(isNull(taskTimersTable.endTime))

  const activeTaskIds = new Set(activeTimers.map(timer => timer.taskId.toString()))

  let tasks: Task[] = dbTasks.map(dbTask => {
    const task = convertDbTaskToApi(dbTask)
    // Override status if there's an active timer
    if (activeTaskIds.has(task.id)) {
      task.status = 'In Progress'
    }
    return task
  })

  // Filter by status if specified
  if (statusFilter && statusFilter !== 'all') {
    tasks = tasks.filter(task => task.status === statusFilter)
  }

  return tasks
}

export async function getTaskById(db: DB, userId: string, taskId: string): Promise<Task | null> {
  const [dbTask] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))

  if (!dbTask) {
    return null
  }

  // Check for active timer
  const [activeTimer] = await db
    .select()
    .from(taskTimersTable)
    .where(and(eq(taskTimersTable.taskId, taskId), isNull(taskTimersTable.endTime)))

  const task = convertDbTaskToApi(dbTask)
  if (activeTimer) {
    task.status = 'In Progress'
  }

  return task
}

export async function createTask(db: DB, userId: string, data: CreateTask): Promise<Task> {
  const now = Math.floor(Date.now() / 1000) // Unix timestamp in seconds
  const taskData: InsertTask = {
    id: createId(),
    userId: userId,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    dueAt: data.dueDate ? Math.floor(new Date(data.dueDate).getTime() / 1000) : null,
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

  const now = Math.floor(Date.now() / 1000)
  const updateData: Partial<InsertTask> = {
    updatedAt: now
  }

  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description.trim() || null
  if (data.dueDate !== undefined) updateData.dueAt = data.dueDate ? Math.floor(new Date(data.dueDate).getTime() / 1000) : null

  // Handle completion status
  if (data.status === 'Done' && !existingTask.completedAt) {
    updateData.completedAt = now
    // End any active timers when marking as done
    await db
      .update(taskTimersTable)
      .set({ endTime: now, updatedAt: now })
      .where(and(eq(taskTimersTable.taskId, taskId), isNull(taskTimersTable.endTime)))
  } else if (data.status !== 'Done' && existingTask.completedAt) {
    updateData.completedAt = null
  }

  const result = await db
    .update(tasksTable)
    .set(updateData)
    .where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId)))
    .returning()

  const updatedDbTask = result[0]
  if (!updatedDbTask) {
    return null
  }

  // Check for active timer to determine status
  const [activeTimer] = await db
    .select()
    .from(taskTimersTable)
    .where(and(eq(taskTimersTable.taskId, taskId), isNull(taskTimersTable.endTime)))

  const task = convertDbTaskToApi(updatedDbTask)
  if (activeTimer && task.status !== 'Done') {
    task.status = 'In Progress'
  }

  return task
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
