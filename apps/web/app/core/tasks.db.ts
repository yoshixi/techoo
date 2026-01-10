import { eq, and, desc, asc, inArray } from 'drizzle-orm'
import { tasksTable, usersTable, taskTagsTable, tagsTable, type InsertTask, type SelectTask, type SelectUser, type InsertTaskTag } from '../db/schema/schema'
import { createId, type DB } from './common.db'
import { formatTimestamp, parseISOToUnixTimestamp, getCurrentUnixTimestamp, validateRequiredString } from './common.core'
import { convertDbTagToApi, type Tag } from './tags.db'

// Define API types without zod dependencies
export interface Task {
  id: string
  title: string
  description: string
  dueDate: string | null
  startAt: string | null
  completedAt: string | null
  tags: Tag[]
  createdAt: string
  updatedAt: string
}

export interface CreateTask {
  title: string
  description?: string
  dueDate?: string
  startAt?: string
  completedAt?: string | null
  tagIds?: string[]
}

export interface UpdateTask {
  title?: string
  description?: string
  dueDate?: string | null
  startAt?: string | null
  completedAt?: string | null
  tagIds?: string[]
}

// Helper function to load tags for a task
async function loadTaskTags(db: DB, taskId: string): Promise<Tag[]> {
  const taskTagsWithTags = await db
    .select({
      tag: tagsTable
    })
    .from(taskTagsTable)
    .innerJoin(tagsTable, eq(taskTagsTable.tagId, tagsTable.id))
    .where(eq(taskTagsTable.taskId, taskId))

  return taskTagsWithTags.map(({ tag }) => convertDbTagToApi(tag))
}

// Helper function to load tags for multiple tasks (efficient batch loading)
async function loadTagsForTasks(db: DB, taskIds: string[]): Promise<Map<string, Tag[]>> {
  if (taskIds.length === 0) return new Map()

  const uniqueIds = Array.from(new Set(taskIds))

  const taskTagsWithTags = await db
    .select({
      taskId: taskTagsTable.taskId,
      tag: tagsTable
    })
    .from(taskTagsTable)
    .innerJoin(tagsTable, eq(taskTagsTable.tagId, tagsTable.id))
    .where(inArray(taskTagsTable.taskId, uniqueIds))

  // Group tags by task ID
  const tagsByTaskId = new Map<string, Tag[]>()
  for (const { taskId, tag } of taskTagsWithTags) {
    const taskIdStr = taskId.toString()
    if (!tagsByTaskId.has(taskIdStr)) {
      tagsByTaskId.set(taskIdStr, [])
    }
    tagsByTaskId.get(taskIdStr)!.push(convertDbTagToApi(tag))
  }

  return tagsByTaskId
}

// Helper function to manage task-tag associations
async function setTaskTags(db: DB, userId: string, taskId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) {
    // Remove all existing tag associations
    await db.delete(taskTagsTable).where(eq(taskTagsTable.taskId, taskId))
    return
  }

  // Validate all tags exist and belong to user
  const validTags = await db
    .select()
    .from(tagsTable)
    .where(
      and(
        eq(tagsTable.userId, userId),
        inArray(tagsTable.id, tagIds)
      )
    )

  if (validTags.length !== tagIds.length) {
    throw new Error('One or more tag IDs are invalid or do not belong to the user')
  }

  // Remove existing associations
  await db.delete(taskTagsTable).where(eq(taskTagsTable.taskId, taskId))

  // Add new associations
  const taskTagData: InsertTaskTag[] = tagIds.map(tagId => ({
    id: createId(),
    taskId: taskId,
    tagId: tagId,
    createdAt: getCurrentUnixTimestamp()
  }))

  await db.insert(taskTagsTable).values(taskTagData)
}

// Convert database task to API task
export function convertDbTaskToApi(dbTask: SelectTask, tags: Tag[] = []): Task {
  return {
    id: dbTask.id.toString(),
    title: dbTask.title,
    description: dbTask.description || '',
    dueDate: dbTask.dueAt ? formatTimestamp(dbTask.dueAt) : null,
    startAt: dbTask.startAt ? formatTimestamp(dbTask.startAt) : null,
    completedAt: dbTask.completedAt ? formatTimestamp(dbTask.completedAt) : null,
    tags: tags,
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

type TaskFilterOptions = {
  completed?: boolean
  sortBy?: 'createdAt' | 'startAt' | 'dueDate'
  order?: 'asc' | 'desc'
  tags?: string[]
}

export async function getAllTasks(db: DB, userId: string, filters?: TaskFilterOptions): Promise<Task[]> {
  // Determine sort field
  let orderByField: typeof tasksTable.createdAt | typeof tasksTable.startAt | typeof tasksTable.dueAt = tasksTable.createdAt
  if (filters?.sortBy === 'startAt') {
    orderByField = tasksTable.startAt
  } else if (filters?.sortBy === 'dueDate') {
    orderByField = tasksTable.dueAt
  }

  // Determine sort order (default to desc for backwards compatibility)
  const sortOrder = filters?.order === 'asc' ? asc : desc

  let dbTasks: SelectTask[]

  // If tag filtering is requested
  if (filters?.tags && filters.tags.length > 0) {
    // Validate that all provided values are valid UUIDs
    const tagIds = filters.tags.filter(tag => {
      // Simple UUID format check
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tag)
    })

    if (tagIds.length === 0) {
      // No valid tag IDs provided, return empty array
      return []
    }

    // Get task IDs that have ANY of these tags (OR logic)
    const taskIdsWithTags = await db
      .selectDistinct({ taskId: taskTagsTable.taskId })
      .from(taskTagsTable)
      .where(inArray(taskTagsTable.tagId, tagIds))

    const taskIds = taskIdsWithTags.map(row => row.taskId.toString())

    if (taskIds.length === 0) {
      return []
    }

    // Get the actual tasks
    dbTasks = await db
      .select()
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.userId, userId),
          inArray(tasksTable.id, taskIds)
        )
      )
      .orderBy(sortOrder(orderByField))
  } else {
    // No tag filtering
    dbTasks = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.userId, userId))
      .orderBy(sortOrder(orderByField))
  }

  // Batch load tags for all tasks
  const taskIds = dbTasks.map(t => t.id.toString())
  const tagsByTaskId = await loadTagsForTasks(db, taskIds)

  // Convert to API format with tags
  let tasks = dbTasks.map(dbTask => {
    const tags = tagsByTaskId.get(dbTask.id.toString()) || []
    return convertDbTaskToApi(dbTask, tags)
  })

  // Apply completion filter (client-side as before)
  if (filters?.completed === true) {
    tasks = tasks.filter((task) => task.completedAt !== null)
  } else if (filters?.completed === false) {
    tasks = tasks.filter((task) => task.completedAt === null)
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

  // Load tags for this task
  const tags = await loadTaskTags(db, taskId)

  return convertDbTaskToApi(dbTask, tags)
}

export async function createTask(db: DB, userId: string, data: CreateTask): Promise<Task> {
  const now = getCurrentUnixTimestamp()
  const taskData: InsertTask = {
    id: createId(),
    userId: userId,
    title: validateRequiredString(data.title, 'Title'),
    description: data.description?.trim() || null,
    dueAt: data.dueDate ? parseISOToUnixTimestamp(data.dueDate) : null,
    startAt: data.startAt ? parseISOToUnixTimestamp(data.startAt) : null,
    completedAt: data.completedAt ? parseISOToUnixTimestamp(data.completedAt) : null,
    createdAt: now,
    updatedAt: now
  }

  const result = await db.insert(tasksTable).values(taskData).returning()
  const dbTask = result[0]
  if (!dbTask) {
    throw new Error('Failed to create task')
  }

  // Handle tag associations
  if (data.tagIds && data.tagIds.length > 0) {
    await setTaskTags(db, userId, dbTask.id.toString(), data.tagIds)
  }

  // Load tags and return complete task
  const tags = data.tagIds && data.tagIds.length > 0
    ? await loadTaskTags(db, dbTask.id.toString())
    : []

  return convertDbTaskToApi(dbTask, tags)
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
  if (data.dueDate !== undefined) {
    updateData.dueAt = data.dueDate ? parseISOToUnixTimestamp(data.dueDate) : null
  }
  if (data.startAt !== undefined) {
    updateData.startAt = data.startAt ? parseISOToUnixTimestamp(data.startAt) : null
  }
  if (data.completedAt !== undefined) {
    updateData.completedAt = data.completedAt ? parseISOToUnixTimestamp(data.completedAt) : null
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

  // Handle tag associations if provided
  if (data.tagIds !== undefined) {
    await setTaskTags(db, userId, taskId, data.tagIds)
  }

  // Load tags and return complete task
  const tags = await loadTaskTags(db, taskId)

  return convertDbTaskToApi(updatedDbTask, tags)
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
