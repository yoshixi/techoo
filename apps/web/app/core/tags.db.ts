import { eq, and, desc, inArray } from 'drizzle-orm'
import { tagsTable, type InsertTag, type SelectTag } from '../db/schema/schema'
import { type DB } from './common.db'
import { formatTimestamp, getCurrentUnixTimestamp, validateRequiredString } from './common.core'

// Define API types without zod dependencies
export interface Tag {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface CreateTag {
  name: string
}

export interface UpdateTag {
  name?: string
}

// Convert database tag to API tag
export function convertDbTagToApi(dbTag: SelectTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    createdAt: formatTimestamp(dbTag.createdAt),
    updatedAt: formatTimestamp(dbTag.updatedAt)
  }
}

// Tag database functions
export async function getAllTags(db: DB, userId: number): Promise<Tag[]> {
  const dbTags = await db
    .select()
    .from(tagsTable)
    .where(eq(tagsTable.userId, userId))
    .orderBy(desc(tagsTable.createdAt))

  return dbTags.map(convertDbTagToApi)
}

export async function getTagById(db: DB, userId: number, tagId: number): Promise<Tag | null> {
  const [dbTag] = await db
    .select()
    .from(tagsTable)
    .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))

  if (!dbTag) {
    return null
  }

  return convertDbTagToApi(dbTag)
}

export async function createTag(db: DB, userId: number, data: CreateTag): Promise<Tag> {
  const now = getCurrentUnixTimestamp()
  const tagData: InsertTag = {
    userId: userId,
    name: validateRequiredString(data.name, 'Tag name'),
    createdAt: now,
    updatedAt: now
  }

  const result = await db.insert(tagsTable).values(tagData).returning()
  const dbTag = result[0]
  if (!dbTag) {
    throw new Error('Failed to create tag')
  }
  return convertDbTagToApi(dbTag)
}

export async function updateTag(db: DB, userId: number, tagId: number, data: UpdateTag): Promise<Tag | null> {
  // Check if tag exists and belongs to user
  const [existingTag] = await db
    .select()
    .from(tagsTable)
    .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))

  if (!existingTag) {
    return null
  }

  const now = getCurrentUnixTimestamp()
  const updateData: Partial<InsertTag> = {
    updatedAt: now
  }

  if (data.name !== undefined) {
    updateData.name = validateRequiredString(data.name, 'Tag name')
  }

  const result = await db
    .update(tagsTable)
    .set(updateData)
    .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))
    .returning()

  const updatedDbTag = result[0]
  if (!updatedDbTag) {
    return null
  }

  return convertDbTagToApi(updatedDbTag)
}

export async function deleteTag(db: DB, userId: number, tagId: number): Promise<Tag | null> {
  const [existingTag] = await db
    .select()
    .from(tagsTable)
    .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))

  if (!existingTag) {
    return null
  }

  // Delete tag (task associations will be deleted automatically due to CASCADE)
  const result = await db
    .delete(tagsTable)
    .where(and(eq(tagsTable.id, tagId), eq(tagsTable.userId, userId)))
    .returning()

  const deletedTag = result[0]
  if (!deletedTag) {
    return null
  }

  return convertDbTagToApi(deletedTag)
}

// Helper function to get tags by IDs (for validation)
export async function getTagsByIds(db: DB, userId: number, tagIds: number[]): Promise<Tag[]> {
  if (tagIds.length === 0) return []

  const uniqueIds = Array.from(new Set(tagIds))
  const dbTags = await db
    .select()
    .from(tagsTable)
    .where(
      and(
        eq(tagsTable.userId, userId),
        inArray(tagsTable.id, uniqueIds)
      )
    )

  return dbTags.map(convertDbTagToApi)
}

// Helper function to get tags by names (for filtering)
export async function getTagsByNames(db: DB, userId: number, names: string[]): Promise<Tag[]> {
  if (names.length === 0) return []

  const uniqueNames = Array.from(new Set(names))
  const dbTags = await db
    .select()
    .from(tagsTable)
    .where(
      and(
        eq(tagsTable.userId, userId),
        inArray(tagsTable.name, uniqueNames)
      )
    )

  return dbTags.map(convertDbTagToApi)
}
