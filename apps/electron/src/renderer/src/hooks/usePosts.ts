import { useCallback, useMemo } from 'react'
import {
  useGetApiV1Posts,
  postApiV1Posts,
  patchApiV1PostsId,
  deleteApiV1PostsId
} from '../gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, GetApiV1PostsParams, Post } from '../gen/api/schemas'

function todayBoundaries(): { from: number; to: number } {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return {
    from: Math.floor(startOfDay.getTime() / 1000),
    to: Math.floor(endOfDay.getTime() / 1000)
  }
}

export function usePosts(options?: { from: number; to: number; limit?: number }): {
  posts: Post[]
  isLoading: boolean
  error: ErrorResponse | undefined
  createPost: (body: string, eventIds: number[], todoIds: number[]) => Promise<void>
  updatePost: (id: number, body: string) => Promise<void>
  deletePost: (id: number) => Promise<void>
} {
  const params = useMemo((): GetApiV1PostsParams => {
    const base = options ?? todayBoundaries()
    return {
      from: new Date(base.from * 1000).toISOString(),
      to: new Date(base.to * 1000).toISOString(),
      ...(options?.limit !== undefined ? { limit: options.limit } : {})
    }
  }, [options])

  const { data, error, isLoading, mutate } = useGetApiV1Posts(params)

  const posts: Post[] = data?.data ?? []

  const createPost = useCallback(
    async (body: string, eventIds: number[], todoIds: number[]) => {
      const optimistic: Post = {
        id: -Math.abs(Date.now()),
        body,
        posted_at: new Date().toISOString(),
        events: [],
        todos: []
      }

      mutate(
        (current) => ({
          data: [optimistic, ...(current?.data ?? [])]
        }),
        { revalidate: false }
      )

      try {
        await postApiV1Posts({
          body,
          event_ids: eventIds,
          todo_ids: todoIds
        })
        await mutate()
      } catch {
        await mutate()
      }
    },
    [mutate]
  )

  const updatePost = useCallback(
    async (id: number, body: string) => {
      const trimmed = body.trim()
      if (!trimmed) return

      mutate(
        (current) => {
          if (!current) return current
          return {
            data: current.data.map((p) => (p.id === id ? { ...p, body: trimmed } : p))
          }
        },
        { revalidate: false }
      )

      try {
        const res = await patchApiV1PostsId(id, { body: trimmed })
        mutate(
          (current) => {
            if (!current) return current
            return {
              data: current.data.map((p) => (p.id === id ? res.data : p))
            }
          },
          { revalidate: false }
        )
      } catch {
        await mutate()
      }
    },
    [mutate]
  )

  const deletePost = useCallback(
    async (id: number) => {
      await deleteApiV1PostsId(id)
      await mutate()
    },
    [mutate]
  )

  return { posts, isLoading, error, createPost, updatePost, deletePost }
}
