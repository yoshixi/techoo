import { useCallback } from 'react'
import { postApiV1Posts, useGetApiV1PostsIdThread } from '../gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, Post } from '../gen/api/schemas'
import { revalidateAllPostFeedCaches } from '../lib/patch-post-caches'

export function usePostThread(postId: number | null): {
  root: Post | null
  replies: Post[]
  isLoading: boolean
  error: ErrorResponse | undefined
  refetch: () => Promise<void>
  createReply: (body: string) => Promise<void>
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
  }
}
