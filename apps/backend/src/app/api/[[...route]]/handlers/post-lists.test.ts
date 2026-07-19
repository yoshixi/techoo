import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { OpenAPIHono } from '@hono/zod-openapi'
import pino from 'pino'
import type { AppBindings } from '../types'
import { listPostsRoute } from '../routes/posts'
import {
  favoritePostRoute,
  unfavoritePostRoute,
  listPostListsRoute,
  createPostListRoute,
  deletePostListRoute,
  addPostToListRoute,
  removePostFromListRoute,
} from '../routes/post-lists'
import { listPostsHandler } from './posts'
import {
  favoritePostHandler,
  unfavoritePostHandler,
  listPostListsHandler,
  createPostListHandler,
  deletePostListHandler,
  addPostToListHandler,
  removePostFromListHandler,
} from './post-lists'
import {
  createSqliteLibsqlTestContext,
  createTestRequest,
  createTestUser,
  type SqliteLibsqlTestContext,
} from '../../../db/tests/sqliteLibsqlTestUtils'
import { postsTable } from '../../../db/schema/schema'
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

  app.openapi(listPostsRoute, listPostsHandler)
  app.openapi(favoritePostRoute, favoritePostHandler)
  app.openapi(unfavoritePostRoute, unfavoritePostHandler)
  app.openapi(listPostListsRoute, listPostListsHandler)
  app.openapi(createPostListRoute, createPostListHandler)
  app.openapi(deletePostListRoute, deletePostListHandler)
  app.openapi(addPostToListRoute, addPostToListHandler)
  app.openapi(removePostFromListRoute, removePostFromListHandler)

  return app
}

describe('Post List and Favorite Handlers', () => {
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
    const user = await createTestUser(testContext.db, 'List User', 'list-user@example.com')
    testUser = { id: user.id, email: user.email, name: user.name }
  })

  afterAll(async () => {
    if (testContext) {
      await testContext.reset()
      await testContext.stop()
    }
  })

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const createPost = async (body = 'test post') => {
    const [row] = await testContext.db.insert(postsTable).values({
      userId: testUser!.id,
      body,
      postedAt: Math.floor(Date.now() / 1000),
    }).returning()
    return row!
  }

  const createList = async (name = 'My List') => {
    const res = await request(new Request('http://localhost/v1/post-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }))
    const json = await res.json() as { data: { id: number; name: string } }
    return json.data
  }

  // ---------------------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------------------

  describe('favoritePost', () => {
    it('returns 204 and marks the post as favorited', async () => {
      const post = await createPost()

      const res = await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, {
        method: 'POST',
      }))

      expect(res.status).toBe(204)

      const feedRes = await request(new Request('http://localhost/v1/posts?favorite=true'))
      const json = await feedRes.json() as { data: { id: number; is_favorited: boolean }[] }
      expect(json.data).toHaveLength(1)
      expect(json.data[0]!.id).toBe(post.id)
      expect(json.data[0]!.is_favorited).toBe(true)
    })

    it('returns 404 when post does not exist', async () => {
      const res = await request(new Request('http://localhost/v1/posts/999999/favorite', {
        method: 'POST',
      }))

      expect(res.status).toBe(404)
    })

    it('is idempotent — favoriting twice succeeds', async () => {
      const post = await createPost()

      await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, { method: 'POST' }))
      const res = await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, { method: 'POST' }))

      expect(res.status).toBe(204)
    })

    it('cannot favorite another user\'s post', async () => {
      const otherUser = await createTestUser(testContext.db, 'Other', 'other@example.com')
      const [otherPost] = await testContext.db.insert(postsTable).values({
        userId: otherUser.id,
        body: 'other post',
        postedAt: 1,
      }).returning()

      const res = await request(new Request(`http://localhost/v1/posts/${otherPost!.id}/favorite`, {
        method: 'POST',
      }))

      expect(res.status).toBe(404)
    })
  })

  describe('unfavoritePost', () => {
    it('returns 204 and removes the favorite', async () => {
      const post = await createPost()
      await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, { method: 'POST' }))

      const res = await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, {
        method: 'DELETE',
      }))

      expect(res.status).toBe(204)

      const feedRes = await request(new Request('http://localhost/v1/posts?favorite=true'))
      const json = await feedRes.json() as { data: unknown[] }
      expect(json.data).toHaveLength(0)
    })

    it('is idempotent — unfavoriting a non-favorited post returns 204', async () => {
      const post = await createPost()

      const res = await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, {
        method: 'DELETE',
      }))

      expect(res.status).toBe(204)
    })
  })

  // ---------------------------------------------------------------------------
  // Post Lists CRUD
  // ---------------------------------------------------------------------------

  describe('listPostLists', () => {
    it('returns an empty array when no lists exist', async () => {
      const res = await request(new Request('http://localhost/v1/post-lists'))

      expect(res.status).toBe(200)
      const json = await res.json() as { data: unknown[] }
      expect(json.data).toHaveLength(0)
    })

    it('returns only the current user\'s lists', async () => {
      const otherUser = await createTestUser(testContext.db, 'Other', 'other2@example.com')
      const savedUser = testUser
      testUser = { id: otherUser.id, email: otherUser.email, name: otherUser.name }
      await createList('Other User List')
      testUser = savedUser

      await createList('My List')

      const res = await request(new Request('http://localhost/v1/post-lists'))
      const json = await res.json() as { data: { name: string }[] }
      expect(json.data).toHaveLength(1)
      expect(json.data[0]!.name).toBe('My List')
    })
  })

  describe('createPostList', () => {
    it('creates a list and returns it', async () => {
      const res = await request(new Request('http://localhost/v1/post-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Reading List' }),
      }))

      expect(res.status).toBe(201)
      const json = await res.json() as { data: { id: number; name: string } }
      expect(json.data.name).toBe('Reading List')
      expect(json.data.id).toBeTypeOf('number')
    })

    it('returns 400 when name is empty', async () => {
      const res = await request(new Request('http://localhost/v1/post-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }))

      expect(res.status).toBe(400)
    })
  })

  describe('deletePostList', () => {
    it('returns 204 and removes the list', async () => {
      const list = await createList('To Delete')

      const res = await request(new Request(`http://localhost/v1/post-lists/${list.id}`, {
        method: 'DELETE',
      }))

      expect(res.status).toBe(204)

      const listsRes = await request(new Request('http://localhost/v1/post-lists'))
      const json = await listsRes.json() as { data: unknown[] }
      expect(json.data).toHaveLength(0)
    })

    it('returns 404 when list does not exist', async () => {
      const res = await request(new Request('http://localhost/v1/post-lists/999999', {
        method: 'DELETE',
      }))

      expect(res.status).toBe(404)
    })

    it('cannot delete another user\'s list', async () => {
      const otherUser = await createTestUser(testContext.db, 'Other', 'other3@example.com')
      const savedUser = testUser
      testUser = { id: otherUser.id, email: otherUser.email, name: otherUser.name }
      const otherList = await createList('Other List')
      testUser = savedUser

      const res = await request(new Request(`http://localhost/v1/post-lists/${otherList.id}`, {
        method: 'DELETE',
      }))

      expect(res.status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------
  // List Items
  // ---------------------------------------------------------------------------

  describe('addPostToList', () => {
    it('returns 204 and adds the post to the list', async () => {
      const post = await createPost()
      const list = await createList()

      const res = await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }))

      expect(res.status).toBe(204)

      const feedRes = await request(new Request(`http://localhost/v1/posts?listIds=${list.id}`))
      const json = await feedRes.json() as { data: { id: number; list_ids: number[] }[] }
      expect(json.data).toHaveLength(1)
      expect(json.data[0]!.id).toBe(post.id)
      expect(json.data[0]!.list_ids).toContain(list.id)
    })

    it('returns 400 when post does not exist', async () => {
      const list = await createList()

      const res = await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: 999999 }),
      }))

      expect(res.status).toBe(400)
    })

    it('returns 400 when list does not exist', async () => {
      const post = await createPost()

      const res = await request(new Request('http://localhost/v1/post-lists/999999/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }))

      expect(res.status).toBe(400)
    })

    it('is idempotent — adding the same post twice succeeds', async () => {
      const post = await createPost()
      const list = await createList()

      await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }))

      const res = await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }))

      expect(res.status).toBe(204)
    })
  })

  describe('removePostFromList', () => {
    it('returns 204 and removes the post from the list', async () => {
      const post = await createPost()
      const list = await createList()
      await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }))

      const res = await request(new Request(
        `http://localhost/v1/post-lists/${list.id}/posts/${post.id}`,
        { method: 'DELETE' }
      ))

      expect(res.status).toBe(204)

      const feedRes = await request(new Request(`http://localhost/v1/posts?listIds=${list.id}`))
      const json = await feedRes.json() as { data: unknown[] }
      expect(json.data).toHaveLength(0)
    })

    it('returns 404 when list does not exist', async () => {
      const post = await createPost()

      const res = await request(new Request(
        `http://localhost/v1/post-lists/999999/posts/${post.id}`,
        { method: 'DELETE' }
      ))

      expect(res.status).toBe(404)
    })
  })

  // ---------------------------------------------------------------------------
  // GET /v1/posts filter params
  // ---------------------------------------------------------------------------

  describe('GET /v1/posts?favorite=true', () => {
    it('returns only favorited posts', async () => {
      const favPost = await createPost('favorited')
      await createPost('not favorited')
      await request(new Request(`http://localhost/v1/posts/${favPost.id}/favorite`, { method: 'POST' }))

      const res = await request(new Request('http://localhost/v1/posts?favorite=true'))

      expect(res.status).toBe(200)
      const json = await res.json() as { data: { id: number }[] }
      expect(json.data).toHaveLength(1)
      expect(json.data[0]!.id).toBe(favPost.id)
    })

    it('returns is_favorited=true for favorited posts in the regular feed', async () => {
      const post = await createPost()
      await request(new Request(`http://localhost/v1/posts/${post.id}/favorite`, { method: 'POST' }))

      const res = await request(new Request('http://localhost/v1/posts'))
      const json = await res.json() as { data: { id: number; is_favorited: boolean }[] }
      const found = json.data.find(p => p.id === post.id)
      expect(found?.is_favorited).toBe(true)
    })

    it('returns is_favorited=false for non-favorited posts', async () => {
      await createPost()

      const res = await request(new Request('http://localhost/v1/posts'))
      const json = await res.json() as { data: { is_favorited: boolean }[] }
      expect(json.data[0]!.is_favorited).toBe(false)
    })
  })

  describe('GET /v1/posts?listIds=...', () => {
    it('returns posts in the specified list', async () => {
      const inList = await createPost('in list')
      await createPost('not in list')
      const list = await createList()
      await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: inList.id }),
      }))

      const res = await request(new Request(`http://localhost/v1/posts?listIds=${list.id}`))

      expect(res.status).toBe(200)
      const json = await res.json() as { data: { id: number }[] }
      expect(json.data).toHaveLength(1)
      expect(json.data[0]!.id).toBe(inList.id)
    })

    it('returns union of posts when multiple listIds are given', async () => {
      const postA = await createPost('post A')
      const postB = await createPost('post B')
      await createPost('post C — not in any list')
      const listA = await createList('List A')
      const listB = await createList('List B')

      await request(new Request(`http://localhost/v1/post-lists/${listA.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postA.id }),
      }))
      await request(new Request(`http://localhost/v1/post-lists/${listB.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postB.id }),
      }))

      const res = await request(new Request(`http://localhost/v1/posts?listIds=${listA.id},${listB.id}`))

      expect(res.status).toBe(200)
      const json = await res.json() as { data: { id: number }[] }
      const ids = json.data.map(p => p.id).sort()
      expect(ids).toEqual([postA.id, postB.id].sort())
    })

    it('returns list_ids for posts in the regular feed', async () => {
      const post = await createPost()
      const list = await createList()
      await request(new Request(`http://localhost/v1/post-lists/${list.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
      }))

      const res = await request(new Request('http://localhost/v1/posts'))
      const json = await res.json() as { data: { id: number; list_ids: number[] }[] }
      const found = json.data.find(p => p.id === post.id)
      expect(found?.list_ids).toContain(list.id)
    })
  })
})
