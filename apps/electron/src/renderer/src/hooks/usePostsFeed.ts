import { useCallback } from 'react'
import {
  postApiV1Posts,
  patchApiV1PostsId,
  deleteApiV1PostsId
} from '../gen/api/endpoints/techooAPI.gen'
import type { Post } from '../gen/api/schemas'
import { usePaginatedPostsFeed } from './usePaginatedPostsFeed'

const DEFAULT_PAGE_SIZE = 30

/**
 * All posts, newest first, with offset pagination (for the Posts tab).
 * Range-based `usePosts` is still used for Today / todo threads.
 */
export function usePostsFeed(pageSize = DEFAULT_PAGE_SIZE): {
  posts: Post[]
  hasMore: boolean
  initialLoading: boolean
  loadingMore: boolean
  error: ReturnType<typeof usePaginatedPostsFeed>['error']
  loadMore: () => Promise<void>
  createPost: (
    body: string,
    eventIds: number[],
    todoIds: number[],
    parentPostId?: number
  ) => Promise<void>
  updatePost: (id: number, body: string) => Promise<void>
  deletePost: (id: number) => Promise<void>
  refetch: () => Promise<void>
} {
  const {
    posts,
    hasMore,
    initialLoading,
    loadingMore,
    error,
    loadMore,
    refetch,
    prependPost,
    patchPost,
    removePost
  } = usePaginatedPostsFeed({ limit: pageSize, offset: 0 })

  const createPost = useCallback(
    async (
      body: string,
      eventIds: number[],
      todoIds: number[],
      parentPostId?: number
    ) => {
      const optimistic: Post = {
        id: -Math.abs(Date.now()),
        body,
        parent_post_id: parentPostId ?? null,
        posted_at: new Date().toISOString(),
        events: [],
        todos: [],
        is_favorited: false,
        list_ids: [],
        reply_count: 0,
      }
      prependPost(optimistic)
      try {
        const res = await postApiV1Posts({
          body,
          parent_post_id: parentPostId,
          event_ids: eventIds,
          todo_ids: todoIds
        })
        removePost(optimistic.id)
        prependPost(res.data)
      } catch {
        removePost(optimistic.id)
      }
    },
    [prependPost, removePost]
  )

  const updatePost = useCallback(
    async (id: number, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return

      patchPost(id, (post) => ({ ...post, body: trimmed }))

      try {
        const res = await patchApiV1PostsId(id, { body: trimmed })
        patchPost(id, () => res.data)
      } catch {
        await refetch()
      }
    },
    [patchPost, refetch]
  )

  const deletePost = useCallback(
    async (id: number) => {
      removePost(id)
      try {
        await deleteApiV1PostsId(id)
      } catch {
        await refetch()
      }
    },
    [removePost, refetch]
  )

  return {
    posts,
    hasMore,
    initialLoading,
    loadingMore,
    error,
    loadMore,
    createPost,
    updatePost,
    deletePost,
    refetch
  }
}
