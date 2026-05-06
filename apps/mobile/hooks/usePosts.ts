import { useCallback, useMemo } from 'react'
import {
  useGetApiV1Posts,
  postApiV1Posts,
  deleteApiV1PostsId,
} from '@/gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, GetApiV1PostsParams, Post } from '@/gen/api/schemas'
import { toRfc3339 } from '@/lib/time'

function todayBoundaries(): { from: Date; to: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endExclusive = new Date(start)
  endExclusive.setDate(endExclusive.getDate() + 1)
  return { from: start, to: endExclusive }
}

export function usePosts(options?: { from: Date; to: Date; limit?: number }): {
  posts: Post[]
  isLoading: boolean
  error: ErrorResponse | undefined
  createPost: (body: string, eventIds: number[], todoIds: number[]) => Promise<void>
  deletePost: (id: number) => Promise<void>
  mutate: ReturnType<typeof useGetApiV1Posts>['mutate']
} {
  const params = useMemo((): GetApiV1PostsParams => {
    const base = options ?? todayBoundaries()
    return {
      from: toRfc3339(base.from),
      to: toRfc3339(base.to),
      ...(options?.limit !== undefined ? { limit: options.limit } : {})
    }
  }, [options?.from?.getTime(), options?.to?.getTime(), options?.limit])
  const { data, error, isLoading, mutate } = useGetApiV1Posts(params)
  const posts: Post[] = data?.data ?? []

  const createPost = useCallback(
    async (body: string, eventIds: number[], todoIds: number[]) => {
      const nowIso = toRfc3339(new Date())
      const optimistic: Post = {
        id: -Math.abs(Date.now()),
        body,
        posted_at: nowIso,
        events: [],
        todos: [],
      }
      mutate(
        (current) => ({
          data: [optimistic, ...(current?.data ?? [])],
        }),
        { revalidate: false }
      )
      try {
        await postApiV1Posts({ body, event_ids: eventIds, todo_ids: todoIds })
        await mutate()
      } catch (err) {
        await mutate()
        throw err
      }
    },
    [mutate]
  )

  const deletePost = useCallback(
    async (id: number) => {
      try {
        await deleteApiV1PostsId(id)
        await mutate()
      } catch (err) {
        await mutate()
        throw err
      }
    },
    [mutate]
  )

  return { posts, isLoading, error, createPost, deletePost, mutate }
}
