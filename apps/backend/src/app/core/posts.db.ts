import { eq, and, sql, desc, inArray, asc, isNull } from 'drizzle-orm'
import {
  postsTable, postEventsTable, postTodosTable, postFavoritesTable, postListItemsTable, postListsTable,
  calendarEventsTable, calendarsTable, todosTable, type SelectPost,
} from '../db/schema/schema'
import { type DB } from './common.db'
import { unixToIso } from './common.core'
import type { Post, CreatePost, UpdatePost } from './posts.core'
import { MAX_POSTS_PAGINATED_LIMIT } from './list-limits'
import { type Result, Ok, Err } from './types'

export interface PostsFilter {
  favorite?: boolean
  listIds?: number[]
}

interface LinkedEvent { id: number; title: string }
interface LinkedTodo { id: number; title: string }

async function validateTodoIds(db: DB, userId: number, todoIds: number[]): Promise<Result<void>> {
  const found = await db.select({ id: todosTable.id }).from(todosTable)
    .where(and(eq(todosTable.userId, userId), inArray(todosTable.id, todoIds)))
  return found.length === todoIds.length ? Ok() : Err('One or more todo_ids not found')
}

async function validateEventIds(db: DB, userId: number, eventIds: number[]): Promise<Result<void>> {
  const found = await db.select({ id: calendarEventsTable.id }).from(calendarEventsTable)
    .innerJoin(calendarsTable, eq(calendarEventsTable.calendarId, calendarsTable.id))
    .where(and(eq(calendarsTable.userId, userId), inArray(calendarEventsTable.id, eventIds)))
  return found.length === eventIds.length ? Ok() : Err('One or more event_ids not found')
}

async function validateParentPostId(db: DB, userId: number, parentPostId: number): Promise<Result<void>> {
  const [parent] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(and(eq(postsTable.id, parentPostId), eq(postsTable.userId, userId)))
  return parent ? Ok() : Err('parent_post_id not found')
}

async function loadPostRelations(db: DB, postId: number): Promise<{ events: LinkedEvent[]; todos: LinkedTodo[] }> {
  const eventRows = await db
    .select({ id: calendarEventsTable.id, title: calendarEventsTable.title })
    .from(postEventsTable)
    .innerJoin(calendarEventsTable, eq(postEventsTable.eventId, calendarEventsTable.id))
    .where(eq(postEventsTable.postId, postId))

  const todoRows = await db
    .select({ id: todosTable.id, title: todosTable.title })
    .from(postTodosTable)
    .innerJoin(todosTable, eq(postTodosTable.todoId, todosTable.id))
    .where(eq(postTodosTable.postId, postId))

  return { events: eventRows, todos: todoRows }
}

async function loadPostRelationsBatch(
  db: DB,
  postIds: number[]
): Promise<{ events: Map<number, LinkedEvent[]>; todos: Map<number, LinkedTodo[]> }> {
  if (postIds.length === 0) return { events: new Map(), todos: new Map() }

  const [eventRows, todoRows] = await Promise.all([
    db
      .select({ postId: postEventsTable.postId, id: calendarEventsTable.id, title: calendarEventsTable.title })
      .from(postEventsTable)
      .innerJoin(calendarEventsTable, eq(postEventsTable.eventId, calendarEventsTable.id))
      .where(inArray(postEventsTable.postId, postIds)),
    db
      .select({ postId: postTodosTable.postId, id: todosTable.id, title: todosTable.title })
      .from(postTodosTable)
      .innerJoin(todosTable, eq(postTodosTable.todoId, todosTable.id))
      .where(inArray(postTodosTable.postId, postIds)),
  ])

  const events = new Map<number, LinkedEvent[]>()
  const todos = new Map<number, LinkedTodo[]>()

  for (const row of eventRows) {
    const list = events.get(row.postId) ?? []
    list.push({ id: row.id, title: row.title })
    events.set(row.postId, list)
  }
  for (const row of todoRows) {
    const list = todos.get(row.postId) ?? []
    list.push({ id: row.id, title: row.title })
    todos.set(row.postId, list)
  }

  return { events, todos }
}

async function loadFavoritesBatch(db: DB, userId: number, postIds: number[]): Promise<Set<number>> {
  if (postIds.length === 0) return new Set()
  const rows = await db
    .select({ postId: postFavoritesTable.postId })
    .from(postFavoritesTable)
    .where(and(eq(postFavoritesTable.userId, userId), inArray(postFavoritesTable.postId, postIds)))
  return new Set(rows.map(r => r.postId))
}

async function loadReplyCountsBatch(db: DB, userId: number, postIds: number[]): Promise<Map<number, number>> {
  if (postIds.length === 0) return new Map()
  const rows = await db
    .select({
      parentPostId: postsTable.parentPostId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(postsTable)
    .where(and(eq(postsTable.userId, userId), inArray(postsTable.parentPostId, postIds)))
    .groupBy(postsTable.parentPostId)
  return new Map(rows.map((row) => [row.parentPostId!, row.count]))
}

async function loadListMembershipsBatch(db: DB, userId: number, postIds: number[]): Promise<Map<number, number[]>> {
  if (postIds.length === 0) return new Map()
  const rows = await db
    .select({ postId: postListItemsTable.postId, listId: postListItemsTable.listId })
    .from(postListItemsTable)
    .innerJoin(postListsTable, eq(postListItemsTable.listId, postListsTable.id))
    .where(and(eq(postListsTable.userId, userId), inArray(postListItemsTable.postId, postIds)))
  const result = new Map<number, number[]>()
  for (const row of rows) {
    const ids = result.get(row.postId) ?? []
    ids.push(row.listId)
    result.set(row.postId, ids)
  }
  return result
}

function convertDbPostToApiSync(
  row: SelectPost,
  events: LinkedEvent[],
  todos: LinkedTodo[],
  isFavorited: boolean,
  listIds: number[],
  replyCount = 0,
): Post {
  return {
    id: row.id,
    parent_post_id: row.parentPostId ?? null,
    body: row.body,
    posted_at: unixToIso(row.postedAt),
    events,
    todos,
    is_favorited: isFavorited,
    list_ids: listIds,
    reply_count: replyCount,
  }
}

async function convertDbPostToApi(db: DB, userId: number, row: SelectPost): Promise<Post> {
  const [{ events, todos }, favorited, listMemberships] = await Promise.all([
    loadPostRelations(db, row.id),
    loadFavoritesBatch(db, userId, [row.id]),
    loadListMembershipsBatch(db, userId, [row.id]),
  ])
  return convertDbPostToApiSync(row, events, todos, favorited.has(row.id), listMemberships.get(row.id) ?? [], 0)
}

function buildFilterConditions(userId: number, filter?: PostsFilter) {
  const extra = []
  if (filter?.favorite) {
    extra.push(sql`${postsTable.id} IN (SELECT post_id FROM post_favorites WHERE user_id = ${userId})`)
  }
  if (filter?.listIds && filter.listIds.length > 0) {
    const ids = filter.listIds.join(',')
    extra.push(sql`${postsTable.id} IN (SELECT post_id FROM post_list_items WHERE list_id IN (${sql.raw(ids)}))`)
  }
  return extra
}

async function enrichPostsBatch(db: DB, userId: number, rows: SelectPost[]): Promise<Post[]> {
  const ids = rows.map(r => r.id)
  const [{ events, todos }, favorited, listMemberships, replyCounts] = await Promise.all([
    loadPostRelationsBatch(db, ids),
    loadFavoritesBatch(db, userId, ids),
    loadListMembershipsBatch(db, userId, ids),
    loadReplyCountsBatch(db, userId, ids),
  ])
  return rows.map(row =>
    convertDbPostToApiSync(
      row,
      events.get(row.id) ?? [],
      todos.get(row.id) ?? [],
      favorited.has(row.id),
      listMemberships.get(row.id) ?? [],
      replyCounts.get(row.id) ?? 0,
    )
  )
}

export async function getPostsByRange(
  db: DB,
  userId: number,
  from: number,
  to: number,
  limitRows: number,
  filter?: PostsFilter,
): Promise<Post[]> {
  const filterConditions = buildFilterConditions(userId, filter)
  const rows = await db
    .select()
    .from(postsTable)
    .where(and(
      eq(postsTable.userId, userId),
      isNull(postsTable.parentPostId),
      sql`${postsTable.postedAt} >= ${from}`,
      sql`${postsTable.postedAt} < ${to}`,
      ...filterConditions,
    ))
    .orderBy(postsTable.postedAt)
    .limit(limitRows)

  if (rows.length === 0) return []
  return enrichPostsBatch(db, userId, rows)
}

/** All posts for the user, newest first, with offset pagination. */
export async function getPostsPaginated(
  db: DB,
  userId: number,
  opts: { limit: number; offset: number; filter?: PostsFilter },
): Promise<{ posts: Post[]; has_more: boolean }> {
  const cap = Math.min(opts.limit, MAX_POSTS_PAGINATED_LIMIT)
  const take = cap + 1

  const filterConditions = buildFilterConditions(userId, opts.filter)
  const rows = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.userId, userId), isNull(postsTable.parentPostId), ...filterConditions))
    .orderBy(desc(postsTable.postedAt), desc(postsTable.id))
    .limit(take)
    .offset(opts.offset)

  const hasMore = rows.length > cap
  const slice = hasMore ? rows.slice(0, cap) : rows
  if (slice.length === 0) return { posts: [], has_more: false }
  const posts = await enrichPostsBatch(db, userId, slice)
  return { posts, has_more: hasMore }
}

export async function getPostById(db: DB, userId: number, postId: number): Promise<Post | null> {
  const [row] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.userId, userId)))

  return row ? convertDbPostToApi(db, userId, row) : null
}

export async function createPost(db: DB, userId: number, data: CreatePost): Promise<Result<Post>> {
  if (data.parent_post_id !== undefined) {
    const v = await validateParentPostId(db, userId, data.parent_post_id)
    if (!v.ok) return v
  }
  if (data.todo_ids && data.todo_ids.length > 0) {
    const v = await validateTodoIds(db, userId, data.todo_ids)
    if (!v.ok) return v
  }
  if (data.event_ids && data.event_ids.length > 0) {
    const v = await validateEventIds(db, userId, data.event_ids)
    if (!v.ok) return v
  }

  const now = Math.floor(Date.now() / 1000)
  const postId = await db.transaction(async (tx) => {
    const [row] = await tx.insert(postsTable).values({
      userId,
      parentPostId: data.parent_post_id ?? null,
      body: data.body.trim(),
      postedAt: data.posted_at ?? now,
    }).returning()

    if (!row) throw new Error('Failed to create post')

    if (data.event_ids && data.event_ids.length > 0) {
      await tx.insert(postEventsTable).values(
        data.event_ids.map(eventId => ({ postId: row.id, eventId }))
      )
    }
    if (data.todo_ids && data.todo_ids.length > 0) {
      await tx.insert(postTodosTable).values(
        data.todo_ids.map(todoId => ({ postId: row.id, todoId }))
      )
    }

    return row.id
  })

  const post = await getPostById(db, userId, postId)
  if (!post) throw new Error('Failed to load created post')
  return Ok(post)
}

export async function updatePost(db: DB, userId: number, postId: number, data: UpdatePost): Promise<Result<Post | null>> {
  if (data.todo_ids && data.todo_ids.length > 0) {
    const v = await validateTodoIds(db, userId, data.todo_ids)
    if (!v.ok) return v
  }
  if (data.event_ids && data.event_ids.length > 0) {
    const v = await validateEventIds(db, userId, data.event_ids)
    if (!v.ok) return v
  }

  const updatedPostId = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(postsTable)
      .where(and(eq(postsTable.id, postId), eq(postsTable.userId, userId)))

    if (!existing) return null

    if (data.body !== undefined) {
      await tx
        .update(postsTable)
        .set({ body: data.body.trim() })
        .where(eq(postsTable.id, postId))
    }

    // Replace junction records atomically so link sets are never partially applied.
    if (data.event_ids !== undefined) {
      await tx.delete(postEventsTable).where(eq(postEventsTable.postId, postId))
      if (data.event_ids.length > 0) {
        await tx.insert(postEventsTable).values(
          data.event_ids.map(eventId => ({ postId, eventId }))
        )
      }
    }
    if (data.todo_ids !== undefined) {
      await tx.delete(postTodosTable).where(eq(postTodosTable.postId, postId))
      if (data.todo_ids.length > 0) {
        await tx.insert(postTodosTable).values(
          data.todo_ids.map(todoId => ({ postId, todoId }))
        )
      }
    }

    return postId
  })

  if (updatedPostId === null) return Ok(null)
  return Ok(await getPostById(db, userId, updatedPostId))
}

export async function deletePost(db: DB, userId: number, postId: number): Promise<Post | null> {
  const post = await getPostById(db, userId, postId)
  if (!post) return null

  // Junction tables cascade-delete via FK
  await db.delete(postsTable).where(and(eq(postsTable.id, postId), eq(postsTable.userId, userId)))
  return post
}

export async function getPostThread(
  db: DB,
  userId: number,
  postId: number
): Promise<{ root: Post; replies: Post[] } | null> {
  const [rootRow] = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.id, postId), eq(postsTable.userId, userId)))
  if (!rootRow) return null

  const replyRows = await db
    .select()
    .from(postsTable)
    .where(and(eq(postsTable.userId, userId), eq(postsTable.parentPostId, postId)))
    .orderBy(asc(postsTable.postedAt), asc(postsTable.id))

  const [root, replies] = await Promise.all([
    convertDbPostToApi(db, userId, rootRow),
    enrichPostsBatch(db, userId, replyRows),
  ])

  return { root, replies }
}
