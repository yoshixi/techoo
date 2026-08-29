import { and, eq } from 'drizzle-orm'
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import pino from 'pino'
import type { AppBindings } from '../types'
import { createPostRoute, updatePostRoute, getPostThreadRoute } from '../routes/posts'
import { createPostHandler, updatePostHandler, getPostThreadHandler } from './posts'
import {
  createSqliteLibsqlTestContext,
  createTestRequest,
  createTestUser,
  type SqliteLibsqlTestContext
} from '../../../db/tests/sqliteLibsqlTestUtils'
import { postsTable, postTodosTable, todosTable } from '../../../db/schema/schema'
import type { DB } from '../../../core/common.db'
import { createOAuthService } from '../../../core/oauth.service'

type TestUser = { id: number; email: string; name: string }

const createTestApp = (getUser: () => TestUser | null, getDb: () => DB) => {
  const app = new OpenAPIHono<AppBindings>()

  app.use('/*', async (c, next) => {
    c.set('logger', pino({ level: 'silent' }))
    c.set('requestId', 'test-request-id')
    const user = getUser()
    if (user) {
      c.set('user', user)
      c.set('db', getDb())
      c.set('oauth', createOAuthService(user.id, getDb()))
    }
    await next()
  })

  app.openapi(createPostRoute, createPostHandler)
  app.openapi(updatePostRoute, updatePostHandler)
  app.openapi(getPostThreadRoute, getPostThreadHandler)

  return app
}

describe('Post Handlers', () => {
  let testContext: SqliteLibsqlTestContext
  let app: OpenAPIHono<AppBindings>
  let request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  let testUser: TestUser | null = null

  beforeAll(async () => {
    testContext = await createSqliteLibsqlTestContext()
    app = createTestApp(() => testUser, () => testContext.db)
    request = createTestRequest(testContext)(app)
  })

  beforeEach(async () => {
    await testContext.reset()
    const user = await createTestUser(testContext.db, 'Post User', 'post-user@example.com')
    testUser = { id: user.id, email: user.email, name: user.name }
  })

  afterAll(async () => {
    if (testContext) {
      await testContext.reset()
      await testContext.stop()
    }
  })

  describe('createPost', () => {
    it('returns 400 and creates no post when todo_ids do not exist', async () => {
      const res = await request(new Request('http://localhost/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'post with invalid todo',
          todo_ids: [999999],
        }),
      }))

      expect(res.status).toBe(400)
      const json = await res.json() as { error: string }
      expect(json.error).toBe('One or more todo_ids not found')

      const posts = await testContext.db.select().from(postsTable).where(eq(postsTable.userId, testUser!.id))
      expect(posts).toHaveLength(0)
    })

    it('creates a post and links valid todos', async () => {
      const [todo] = await testContext.db.insert(todosTable).values({
        userId: testUser!.id,
        title: 'a valid todo',
      }).returning()

      const res = await request(new Request('http://localhost/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'post with valid todo',
          todo_ids: [todo.id],
        }),
      }))

      expect(res.status).toBe(201)

      const posts = await testContext.db.select().from(postsTable).where(eq(postsTable.userId, testUser!.id))
      expect(posts).toHaveLength(1)
      const links = await testContext.db.select().from(postTodosTable).where(eq(postTodosTable.postId, posts[0]!.id))
      expect(links).toEqual([{ postId: posts[0]!.id, todoId: todo.id }])
    })

    it('creates a reply post when parent_post_id exists', async () => {
      const [parent] = await testContext.db.insert(postsTable).values({
        userId: testUser!.id,
        body: 'root post',
        postedAt: 123,
      }).returning()

      const res = await request(new Request('http://localhost/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'reply post',
          parent_post_id: parent.id,
        }),
      }))

      expect(res.status).toBe(201)
      const json = await res.json() as { data: { parent_post_id: number | null } }
      expect(json.data.parent_post_id).toBe(parent.id)
    })

    it('returns 400 when mixing valid and invalid todo_ids', async () => {
      const [todo] = await testContext.db.insert(todosTable).values({
        userId: testUser!.id,
        title: 'real todo',
      }).returning()

      const res = await request(new Request('http://localhost/v1/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'post with mixed todos',
          todo_ids: [todo.id, 999999],
        }),
      }))

      expect(res.status).toBe(400)
      const posts = await testContext.db.select().from(postsTable).where(eq(postsTable.userId, testUser!.id))
      expect(posts).toHaveLength(0)
    })
  })

  describe('updatePost', () => {
    it('returns 400 and preserves original data when todo_ids do not exist', async () => {
      const [todo] = await testContext.db.insert(todosTable).values({
        userId: testUser!.id,
        title: 'linked todo',
      }).returning()

      const [post] = await testContext.db.insert(postsTable).values({
        userId: testUser!.id,
        body: 'original body',
        postedAt: 123,
      }).returning()

      await testContext.db.insert(postTodosTable).values({
        postId: post.id,
        todoId: todo.id,
      })

      const res = await request(new Request(`http://localhost/v1/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'updated body',
          todo_ids: [999999],
        }),
      }))

      expect(res.status).toBe(400)
      const json = await res.json() as { error: string }
      expect(json.error).toBe('One or more todo_ids not found')

      const [storedPost] = await testContext.db
        .select()
        .from(postsTable)
        .where(and(eq(postsTable.id, post.id), eq(postsTable.userId, testUser!.id)))
      const links = await testContext.db
        .select()
        .from(postTodosTable)
        .where(eq(postTodosTable.postId, post.id))

      expect(storedPost?.body).toBe('original body')
      expect(links).toEqual([{ postId: post.id, todoId: todo.id }])
    })

    it('updates the post and replaces linked todos with valid ids', async () => {
      const [oldTodo] = await testContext.db.insert(todosTable).values({
        userId: testUser!.id,
        title: 'old todo',
      }).returning()

      const [newTodo] = await testContext.db.insert(todosTable).values({
        userId: testUser!.id,
        title: 'new todo',
      }).returning()

      const [post] = await testContext.db.insert(postsTable).values({
        userId: testUser!.id,
        body: 'original body',
        postedAt: 123,
      }).returning()

      await testContext.db.insert(postTodosTable).values({ postId: post.id, todoId: oldTodo.id })

      const res = await request(new Request(`http://localhost/v1/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'updated body',
          todo_ids: [newTodo.id],
        }),
      }))

      expect(res.status).toBe(200)

      const [storedPost] = await testContext.db
        .select()
        .from(postsTable)
        .where(and(eq(postsTable.id, post.id), eq(postsTable.userId, testUser!.id)))
      const links = await testContext.db
        .select()
        .from(postTodosTable)
        .where(eq(postTodosTable.postId, post.id))

      expect(storedPost?.body).toBe('updated body')
      expect(links).toEqual([{ postId: post.id, todoId: newTodo.id }])
    })
  })

  describe('getPostThread', () => {
    it('returns root post with direct replies in chronological order', async () => {
      const [root] = await testContext.db.insert(postsTable).values({
        userId: testUser!.id,
        body: 'root',
        postedAt: 100,
      }).returning()

      await testContext.db.insert(postsTable).values([
        { userId: testUser!.id, body: 'reply 2', parentPostId: root.id, postedAt: 300 },
        { userId: testUser!.id, body: 'reply 1', parentPostId: root.id, postedAt: 200 },
      ])

      const res = await request(new Request(`http://localhost/v1/posts/${root.id}/thread`, {
        method: 'GET',
      }))

      expect(res.status).toBe(200)
      const json = await res.json() as {
        data: { root: { id: number; body: string }; replies: Array<{ body: string; parent_post_id: number | null }> }
      }
      expect(json.data.root.id).toBe(root.id)
      expect(json.data.replies.map((reply) => reply.body)).toEqual(['reply 1', 'reply 2'])
      expect(json.data.replies.every((reply) => reply.parent_post_id === root.id)).toBe(true)
    })

    it('returns 404 for missing root post', async () => {
      const res = await request(new Request('http://localhost/v1/posts/999999/thread', {
        method: 'GET',
      }))
      expect(res.status).toBe(404)
      const json = await res.json() as { error: string }
      expect(json.error).toBe('Post not found')
    })
  })
})
