import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  createSqliteLibsqlTestContext,
  createTestUser,
  type SqliteLibsqlTestContext,
} from '../db/tests/sqliteLibsqlTestUtils'
import {
  postsTable,
  postTodosTable,
  postEventsTable,
  todosTable,
  calendarsTable,
  calendarEventsTable,
} from '../db/schema/schema'
import { createPost, getPostThread, getPostsPaginated, getPostsByRange } from './posts.db'

type TestUser = { id: number }

describe('posts.db', () => {
  let ctx: SqliteLibsqlTestContext
  let user: TestUser

  beforeAll(async () => {
    ctx = await createSqliteLibsqlTestContext()
  })

  afterAll(async () => {
    await ctx.reset()
    ctx.stop()
  })

  beforeEach(async () => {
    await ctx.reset()
    user = await createTestUser(ctx.db, 'Test User', 'test@example.com')
  })

  const insertPost = (postedAt: number, body = 'post') =>
    ctx.db.insert(postsTable).values({ userId: user.id, body, postedAt }).returning().then(([r]) => r!)

  const insertTodo = (title: string) =>
    ctx.db.insert(todosTable).values({ userId: user.id, title }).returning().then(([r]) => r!)

  const insertCalendar = () =>
    ctx.db.insert(calendarsTable).values({
      userId: user.id,
      providerType: 'google',
      providerAccountId: 'acc-1',
      providerCalendarId: 'cal-1',
      name: 'Test Calendar',
    }).returning().then(([r]) => r!)

  const insertEvent = (calendarId: number, title: string) =>
    ctx.db.insert(calendarEventsTable).values({
      calendarId,
      providerType: 'google',
      providerEventId: `evt-${title}`,
      title,
      startAt: new Date(1000000),
      endAt: new Date(2000000),
    }).returning().then(([r]) => r!)

  describe('getPostsPaginated', () => {
    it('returns posts with linked todos and events', async () => {
      const todo = await insertTodo('todo A')
      const cal = await insertCalendar()
      const event = await insertEvent(cal.id, 'event A')
      const post = await insertPost(100)

      await ctx.db.insert(postTodosTable).values({ postId: post.id, todoId: todo.id })
      await ctx.db.insert(postEventsTable).values({ postId: post.id, eventId: event.id })

      const result = await getPostsPaginated(ctx.db, user.id, { limit: 10, offset: 0 })

      expect(result.has_more).toBe(false)
      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]!.todos).toEqual([{ id: todo.id, title: 'todo A' }])
      expect(result.posts[0]!.events).toEqual([{ id: event.id, title: 'event A' }])
    })

    it('returns posts without relations as empty arrays', async () => {
      await insertPost(100)

      const result = await getPostsPaginated(ctx.db, user.id, { limit: 10, offset: 0 })

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]!.todos).toEqual([])
      expect(result.posts[0]!.events).toEqual([])
    })

    it('returns posts newest first', async () => {
      await insertPost(100, 'first')
      await insertPost(200, 'second')
      await insertPost(300, 'third')

      const result = await getPostsPaginated(ctx.db, user.id, { limit: 10, offset: 0 })

      expect(result.posts.map((p) => p.body)).toEqual(['third', 'second', 'first'])
    })

    it('sets has_more when more rows exist beyond limit', async () => {
      await insertPost(100, 'a')
      await insertPost(200, 'b')
      await insertPost(300, 'c')

      const result = await getPostsPaginated(ctx.db, user.id, { limit: 2, offset: 0 })

      expect(result.has_more).toBe(true)
      expect(result.posts).toHaveLength(2)
    })

    it('returns empty result when user has no posts', async () => {
      const result = await getPostsPaginated(ctx.db, user.id, { limit: 10, offset: 0 })

      expect(result.posts).toEqual([])
      expect(result.has_more).toBe(false)
    })

    it('correctly maps relations to multiple posts', async () => {
      const todo1 = await insertTodo('todo 1')
      const todo2 = await insertTodo('todo 2')
      const post1 = await insertPost(100, 'post 1')
      const post2 = await insertPost(200, 'post 2')

      await ctx.db.insert(postTodosTable).values({ postId: post1.id, todoId: todo1.id })
      await ctx.db.insert(postTodosTable).values({ postId: post2.id, todoId: todo2.id })

      const result = await getPostsPaginated(ctx.db, user.id, { limit: 10, offset: 0 })
      const byBody = Object.fromEntries(result.posts.map((p) => [p.body, p]))

      expect(byBody['post 1']!.todos).toEqual([{ id: todo1.id, title: 'todo 1' }])
      expect(byBody['post 2']!.todos).toEqual([{ id: todo2.id, title: 'todo 2' }])
    })
  })

  describe('getPostsByRange', () => {
    it('returns posts within the half-open interval [from, to)', async () => {
      await insertPost(100, 'before')
      await insertPost(200, 'at from')
      await insertPost(250, 'inside')
      await insertPost(300, 'at to excluded')
      await insertPost(400, 'after')

      const result = await getPostsByRange(ctx.db, user.id, 200, 300, 100)

      expect(result.map((p) => p.body)).toEqual(['at from', 'inside'])
    })

    it('returns posts with linked todos and events', async () => {
      const todo = await insertTodo('range todo')
      const cal = await insertCalendar()
      const event = await insertEvent(cal.id, 'range event')
      const post = await insertPost(250)

      await ctx.db.insert(postTodosTable).values({ postId: post.id, todoId: todo.id })
      await ctx.db.insert(postEventsTable).values({ postId: post.id, eventId: event.id })

      const result = await getPostsByRange(ctx.db, user.id, 200, 300, 100)

      expect(result).toHaveLength(1)
      expect(result[0]!.todos).toEqual([{ id: todo.id, title: 'range todo' }])
      expect(result[0]!.events).toEqual([{ id: event.id, title: 'range event' }])
    })

    it('returns empty array when no posts in range', async () => {
      await insertPost(100)
      await insertPost(400)

      const result = await getPostsByRange(ctx.db, user.id, 200, 300, 100)

      expect(result).toEqual([])
    })
  })

  describe('createPost', () => {
    it('creates a reply post when parent_post_id belongs to user', async () => {
      const parent = await insertPost(1_000, 'root post')

      const result = await createPost(ctx.db, user.id, {
        body: 'reply body',
        parent_post_id: parent.id,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.parent_post_id).toBe(parent.id)
    })

    it('rejects parent_post_id that is not owned by the user', async () => {
      const otherUser = await createTestUser(ctx.db, 'Other User', 'other-user@example.com')
      const [foreignParent] = await ctx.db
        .insert(postsTable)
        .values({ userId: otherUser.id, body: 'other root', postedAt: 1_000 })
        .returning()

      const result = await createPost(ctx.db, user.id, {
        body: 'should fail',
        parent_post_id: foreignParent!.id,
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('parent_post_id not found')
    })
  })

  describe('getPostThread', () => {
    it('returns root with direct replies sorted oldest-first', async () => {
      const root = await insertPost(1_000, 'root')
      await insertPost(500, 'unrelated')
      await ctx.db.insert(postsTable).values({
        userId: user.id,
        parentPostId: root.id,
        body: 'newest direct reply',
        postedAt: 1_300,
      })
      await ctx.db.insert(postsTable).values({
        userId: user.id,
        parentPostId: root.id,
        body: 'oldest direct reply',
        postedAt: 1_100,
      })
      await ctx.db.insert(postsTable).values({
        userId: user.id,
        parentPostId: root.id,
        body: 'middle direct reply',
        postedAt: 1_200,
      })

      const thread = await getPostThread(ctx.db, user.id, root.id)

      expect(thread?.root.id).toBe(root.id)
      expect(thread?.replies.map((p) => p.body)).toEqual([
        'oldest direct reply',
        'middle direct reply',
        'newest direct reply',
      ])
    })

    it('returns null when root post is missing or not owned by user', async () => {
      expect(await getPostThread(ctx.db, user.id, 999_999)).toBeNull()

      const otherUser = await createTestUser(ctx.db, 'Other User 2', 'other-user-2@example.com')
      const [foreignRoot] = await ctx.db
        .insert(postsTable)
        .values({ userId: otherUser.id, body: 'other root', postedAt: 1_000 })
        .returning()

      expect(await getPostThread(ctx.db, user.id, foreignRoot!.id)).toBeNull()
    })
  })
})
