import type { RouteHandler } from '@hono/zod-openapi'
import type { AppBindings } from '../types'
import {
  favoritePostRoute,
  unfavoritePostRoute,
  listPostListsRoute,
  createPostListRoute,
  updatePostListRoute,
  deletePostListRoute,
  addPostToListRoute,
  removePostFromListRoute,
} from '../routes/post-lists'
import {
  favoritePost,
  unfavoritePost,
  getPostLists,
  createPostList,
  updatePostList,
  deletePostList,
  addPostToList,
  removePostFromList,
} from '../../../core/post-lists.db'

export const favoritePostHandler: RouteHandler<typeof favoritePostRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const result = await favoritePost(db, user.id, id)
    if (!result.ok) return c.json({ error: result.error }, 404)
    return c.body(null, 204)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to favorite post')
    return c.json({ error: 'Failed to favorite post' }, 500)
  }
}

export const unfavoritePostHandler: RouteHandler<typeof unfavoritePostRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    await unfavoritePost(db, user.id, id)
    return c.body(null, 204)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to unfavorite post')
    return c.json({ error: 'Failed to unfavorite post' }, 500)
  }
}

export const listPostListsHandler: RouteHandler<typeof listPostListsRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const lists = await getPostLists(db, user.id)
    return c.json({ data: lists }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to list post lists')
    return c.json({ error: 'Failed to list post lists' }, 500)
  }
}

export const createPostListHandler: RouteHandler<typeof createPostListRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { name } = c.req.valid('json')
    const list = await createPostList(db, user.id, name)
    return c.json({ data: list }, 201)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to create post list')
    return c.json({ error: 'Failed to create post list' }, 500)
  }
}

export const deletePostListHandler: RouteHandler<typeof deletePostListRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const result = await deletePostList(db, user.id, id)
    if (!result.ok) return c.json({ error: result.error }, 404)
    return c.body(null, 204)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to delete post list')
    return c.json({ error: 'Failed to delete post list' }, 500)
  }
}

export const updatePostListHandler: RouteHandler<typeof updatePostListRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const { name } = c.req.valid('json')
    const result = await updatePostList(db, user.id, id, name)
    if (!result.ok) return c.json({ error: result.error }, 404)
    return c.json({ data: result.value }, 200)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to update post list')
    return c.json({ error: 'Failed to update post list' }, 500)
  }
}

export const addPostToListHandler: RouteHandler<typeof addPostToListRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const { post_id } = c.req.valid('json')
    const result = await addPostToList(db, user.id, id, post_id)
    if (!result.ok) return c.json({ error: result.error }, 400)
    return c.body(null, 204)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to add post to list')
    return c.json({ error: 'Failed to add post to list' }, 500)
  }
}

export const removePostFromListHandler: RouteHandler<typeof removePostFromListRoute, AppBindings> = async (c) => {
  try {
    const db = c.get('db')
    const user = c.get('user')
    const { id, postId } = c.req.valid('param')
    const result = await removePostFromList(db, user.id, id, postId)
    if (!result.ok) return c.json({ error: result.error }, 404)
    return c.body(null, 204)
  } catch (error) {
    c.get('logger').error({ err: error }, 'failed to remove post from list')
    return c.json({ error: 'Failed to remove post from list' }, 500)
  }
}
