import { useCallback } from 'react'
import {
  deleteApiV1PostsId,
  patchApiV1PostsId,
  postApiV1Posts,
  useGetApiV1PostsIdThread,
} from '../gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, Post } from '../gen/api/schemas'
import { revalidateAllPostFeedCaches } from '../lib/patch-post-caches'

export function usePostThread(postId: number | null): {
  root: Post | null
  replies: Post[]
  isLoading: boolean
  error: ErrorResponse | undefined
  refetch: () => Promise<void>
  createReply: (body: string) => Promise<void>
  updatePost: (id: number, body: string) => Promise<void>
  deletePost: (id: number) => Promise<void>
} {
  const threadQuery = useGetApiV1PostsIdThread(postId ?? 0, {
    swr: {
      enabled: postId != null,
      revalidateOnFocus: false,
    },
  })

  const root = threadQuery.data?.data.root ?? null
  const replies = threadQuery.data?.data.replies ?? []

  const createReply = useCallback(
    async (body: string) => {
      if (postId == null) return
      const trimmed = body.trim()
      if (!trimmed) return

      const optimistic: Post = {
        id: -Math.abs(Date.now()),
        body: trimmed,
        parent_post_id: postId,
        posted_at: new Date().toISOString(),
        events: [],
        todos: [],
        is_favorited: false,
        list_ids: [],
        reply_count: 0,
      }

      await threadQuery.mutate(
        (current) => {
          if (!current?.data.root) return current
          return {
            data: {
              root: current.data.root,
              replies: [...current.data.replies, optimistic],
            },
          }
        },
        { revalidate: false }
      )

      try {
        await postApiV1Posts({
          body: trimmed,
          parent_post_id: postId,
        })
        await Promise.all([threadQuery.mutate(), revalidateAllPostFeedCaches()])
      } catch (error) {
        await threadQuery.mutate()
        throw error
      }
    },
    [postId, threadQuery]
  )

  const updatePost = useCallback(
    async (id: number, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return
      await patchApiV1PostsId(id, { body: trimmed })
      await Promise.all([threadQuery.mutate(), revalidateAllPostFeedCaches()])
    },
    [threadQuery]
  )

  const deletePost = useCallback(
    async (id: number) => {
      await deleteApiV1PostsId(id)
      await Promise.all([threadQuery.mutate(), revalidateAllPostFeedCaches()])
    },
    [threadQuery]
  )

  const refetch = useCallback(async () => {
    await threadQuery.mutate()
  }, [threadQuery])

  return {
    root,
    replies,
    isLoading: threadQuery.isLoading,
    error: threadQuery.error as ErrorResponse | undefined,
    refetch,
    createReply,
    updatePost,
    deletePost,
  }
}
