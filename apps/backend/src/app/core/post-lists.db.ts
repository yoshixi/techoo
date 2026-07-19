import { eq, and } from 'drizzle-orm'
import {
  postFavoritesTable,
  postListsTable,
  postListItemsTable,
  postsTable,
} from '../db/schema/schema'
import { type DB } from './common.db'
import { type Result, Ok, Err } from './types'
import type { PostList } from './post-lists.core'

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function favoritePost(db: DB, userId: number, postId: number): Promise<Result> {
  const [post] = await db.select({ id: postsTable.id }).from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.userId, userId)))
  if (!post) return Err('Post not found')

  await db.insert(postFavoritesTable)
    .values({ userId, postId })
    .onConflictDoNothing()
  return Ok()
}

export async function unfavoritePost(db: DB, userId: number, postId: number): Promise<Result> {
  await db.delete(postFavoritesTable)
    .where(and(eq(postFavoritesTable.userId, userId), eq(postFavoritesTable.postId, postId)))
  return Ok()
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

function rowToPostList(row: { id: number; name: string; createdAt: number }): PostList {
  return { id: row.id, name: row.name, created_at: row.createdAt }
}

export async function getPostLists(db: DB, userId: number): Promise<PostList[]> {
  const rows = await db.select().from(postListsTable)
    .where(eq(postListsTable.userId, userId))
    .orderBy(postListsTable.createdAt)
  return rows.map(rowToPostList)
}

export async function createPostList(db: DB, userId: number, name: string): Promise<PostList> {
  const [row] = await db.insert(postListsTable).values({ userId, name: name.trim() }).returning()
  if (!row) throw new Error('Failed to create post list')
  return rowToPostList(row)
}

export async function updatePostList(
  db: DB,
  userId: number,
  listId: number,
  name: string
): Promise<Result<PostList>> {
  const [existing] = await db.select({ id: postListsTable.id }).from(postListsTable)
    .where(and(eq(postListsTable.id, listId), eq(postListsTable.userId, userId)))
  if (!existing) return Err('List not found')

  const [row] = await db.update(postListsTable)
    .set({ name: name.trim() })
    .where(and(eq(postListsTable.id, listId), eq(postListsTable.userId, userId)))
    .returning()
  if (!row) return Err('List not found')
  return Ok(rowToPostList(row))
}

export async function deletePostList(db: DB, userId: number, listId: number): Promise<Result> {
  const [existing] = await db.select({ id: postListsTable.id }).from(postListsTable)
    .where(and(eq(postListsTable.id, listId), eq(postListsTable.userId, userId)))
  if (!existing) return Err('List not found')

  // Items cascade via FK
  await db.delete(postListsTable)
    .where(and(eq(postListsTable.id, listId), eq(postListsTable.userId, userId)))
  return Ok()
}

// ---------------------------------------------------------------------------
// List items
// ---------------------------------------------------------------------------

export async function addPostToList(db: DB, userId: number, listId: number, postId: number): Promise<Result> {
  const [list] = await db.select({ id: postListsTable.id }).from(postListsTable)
    .where(and(eq(postListsTable.id, listId), eq(postListsTable.userId, userId)))
  if (!list) return Err('List not found')

  const [post] = await db.select({ id: postsTable.id }).from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.userId, userId)))
  if (!post) return Err('Post not found')

  await db.insert(postListItemsTable)
    .values({ listId, postId })
    .onConflictDoNothing()
  return Ok()
}

export async function removePostFromList(db: DB, userId: number, listId: number, postId: number): Promise<Result> {
  const [list] = await db.select({ id: postListsTable.id }).from(postListsTable)
    .where(and(eq(postListsTable.id, listId), eq(postListsTable.userId, userId)))
  if (!list) return Err('List not found')

  await db.delete(postListItemsTable)
    .where(and(eq(postListItemsTable.listId, listId), eq(postListItemsTable.postId, postId)))
  return Ok()
}
