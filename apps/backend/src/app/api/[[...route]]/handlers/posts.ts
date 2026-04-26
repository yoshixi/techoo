import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import { listPostsRoute, createPostRoute, updatePostRoute, deletePostRoute } from '../routes/posts'
import { getPostsByRange, getPostsPaginated, createPost, updatePost, deletePost } from '../../../core/posts.db'
import { clampPostsPaginatedLimit, clampPostsRangeLimit } from '../../../core/list-limits'

export const listPostsHandler: RouteHandler<typeof listPostsRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const q = c.req.valid('query')
    if (q.from != null && q.to != null) {
      const rangeLimit = clampPostsRangeLimit(q.limit)
      const posts = await getPostsByRange(db, user.id, q.from, q.to, rangeLimit)
      return c.json({ data: posts }, 200)
    }
    const limit = clampPostsPaginatedLimit(q.limit ?? undefined)
    const offset = q.offset ?? 0
    const { posts, has_more } = await getPostsPaginated(db, user.id, { limit, offset })
    return c.json({ data: posts, has_more }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to fetch posts')
    return c.json({ error: 'Failed to fetch posts' }, 500)
  }
}

export const createPostHandler: RouteHandler<typeof createPostRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const data = c.req.valid('json')
    const result = await createPost(db, user.id, data)
    if (!result.ok) return c.json({ error: result.error }, 400)
    return c.json({ data: result.value }, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to create post')
    return c.json({ error: 'Failed to create post' }, 500)
  }
}

export const updatePostHandler: RouteHandler<typeof updatePostRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const data = c.req.valid('json')
    const result = await updatePost(db, user.id, id, data)
    if (!result.ok) return c.json({ error: result.error }, 400)
    if (!result.value) return c.json({ error: 'Post not found' }, 404)
    return c.json({ data: result.value }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to update post')
    return c.json({ error: 'Failed to update post' }, 500)
  }
}

export const deletePostHandler: RouteHandler<typeof deletePostRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const post = await deletePost(db, user.id, id)
    if (!post) return c.json({ error: 'Post not found' }, 404)
    return c.json({ data: post }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to delete post')
    return c.json({ error: 'Failed to delete post' }, 500)
  }
}
