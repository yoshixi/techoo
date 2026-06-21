import { useCallback, useMemo } from 'react'
import type { Key } from 'swr'
import {
  useGetApiV1Todos,
  postApiV1Todos,
  patchApiV1TodosId,
  deleteApiV1TodosId,
} from '@/gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, GetApiV1TodosParams, Todo, UpdateTodo } from '@/gen/api/schemas'
import { revalidateAllTodoLists } from '@/lib/revalidateTodoLists'
import { toRfc3339 } from '@/lib/time'

const TODO_LIST_LIMIT = 500

function updatesToPatch(
  updates: {
    title?: string
    description?: string | null
    starts_at?: Date | null
    ends_at?: Date | null
    is_all_day?: number
    done?: number
  }
): UpdateTodo {
  const patch: UpdateTodo = {}
  if (updates.title !== undefined) patch.title = updates.title
  if (updates.description !== undefined) patch.description = updates.description
  if (updates.starts_at !== undefined) {
    patch.starts_at = updates.starts_at == null ? null : toRfc3339(updates.starts_at)
  }
  if (updates.ends_at !== undefined) {
    patch.ends_at = updates.ends_at == null ? null : toRfc3339(updates.ends_at)
  }
  if (updates.is_all_day !== undefined) patch.is_all_day = updates.is_all_day
  if (updates.done !== undefined) patch.done = updates.done
  return patch
}

function optimisticTodoMerge(t: Todo, updates: Parameters<typeof updatesToPatch>[0]): Todo {
  const patch = updatesToPatch(updates)
  return { ...t, ...patch }
}

export function useTodos(options?: {
  from?: Date
  to?: Date
  showAll?: boolean
  includeCompletedInRange?: boolean
  includeDone?: boolean
  fetchAll?: boolean
}): {
  todos: Todo[]
  isLoading: boolean
  error: ErrorResponse | undefined
  createTodo: (title: string, startsAt?: Date, endsAt?: Date, isAllDay?: number) => Promise<Todo>
  updateTodo: (
    id: number,
    updates: {
      title?: string
      description?: string | null
      starts_at?: Date | null
      ends_at?: Date | null
      is_all_day?: number
      done?: number
    }
  ) => Promise<void>
  toggleDone: (id: number, currentDone: number) => Promise<void>
  deleteTodo: (id: number) => Promise<void>
  mutate: ReturnType<typeof useGetApiV1Todos>['mutate']
} {
  const params: GetApiV1TodosParams | undefined = useMemo(() => {
    if (options?.fetchAll) return { limit: TODO_LIST_LIMIT }
    if (options?.showAll) return { done: 'false' as const, limit: TODO_LIST_LIMIT }
    if (options?.from != null && options?.to != null) {
      const from = toRfc3339(options.from)
      const to = toRfc3339(options.to)
      if (options.includeDone) {
        return { from, to, limit: TODO_LIST_LIMIT }
      }
      if (options.includeCompletedInRange === false) {
        return { from, to, done: 'false' as const, limit: TODO_LIST_LIMIT }
      }
      return { from, to, limit: TODO_LIST_LIMIT }
    }
    if (options?.includeDone) return { limit: TODO_LIST_LIMIT }
    return { done: 'false' as const, limit: TODO_LIST_LIMIT }
  }, [
    options?.from?.getTime(),
    options?.to?.getTime(),
    options?.showAll,
    options?.fetchAll,
    options?.includeCompletedInRange,
    options?.includeDone,
  ])

  /** Primitive tuple so SWR cache always tracks range/filters (avoids stale lists when the day changes). */
  const swrKey = useMemo<Key>(
    () => [
      '/api/v1/todos',
      params?.from ?? null,
      params?.to ?? null,
      params?.done ?? null,
      params?.limit ?? null,
    ],
    [params?.from, params?.to, params?.done, params?.limit]
  )

  const { data, isLoading, error, mutate } = useGetApiV1Todos(params, {
    swr: { swrKey },
  })
  const todos = data?.data ?? []

  /** Lists that only fetch open items — completed rows must leave the cache without a global refetch. */
  const listOpenOnly = params?.done === 'false'

  const createTodo = useCallback(
    async (title: string, startsAt?: Date, endsAt?: Date, isAllDay?: number): Promise<Todo> => {
      const nowIso = toRfc3339(new Date())
      const allDay = isAllDay ?? 0
      const tempId = -Math.abs(Date.now())
      const optimisticTodo: Todo = {
        id: tempId,
        title,
        description: null,
        starts_at: startsAt != null ? toRfc3339(startsAt) : null,
        ends_at: endsAt != null ? toRfc3339(endsAt) : null,
        is_all_day: allDay,
        done: 0,
        done_at: null,
        created_at: nowIso,
      }
      mutate(
        (current) => {
          if (!current) return { data: [optimisticTodo] }
          return { data: [...current.data, optimisticTodo] }
        },
        { revalidate: false }
      )
      try {
        const res = await postApiV1Todos({
          title,
          starts_at: startsAt != null ? toRfc3339(startsAt) : undefined,
          ends_at: endsAt != null ? toRfc3339(endsAt) : undefined,
          is_all_day: allDay,
        })
        await revalidateAllTodoLists()
        return res.data
      } catch (err) {
        await revalidateAllTodoLists()
        throw err
      }
    },
    [mutate]
  )

  const toggleDone = useCallback(
    async (id: number, currentDone: number) => {
      const newDone = currentDone === 1 ? 0 : 1
      const nowIso = toRfc3339(new Date())
      mutate(
        (current) => {
          if (!current) return current
          if (newDone === 1 && listOpenOnly) {
            return { data: current.data.filter((t) => t.id !== id) }
          }
          return {
            data: current.data.map((t) =>
              t.id === id
                ? { ...t, done: newDone, done_at: newDone === 1 ? nowIso : null }
                : t
            ),
          }
        },
        { revalidate: false }
      )
      try {
        await patchApiV1TodosId(id, { done: newDone })
        await revalidateAllTodoLists()
      } catch (err) {
        await revalidateAllTodoLists()
        throw err
      }
    },
    [mutate, listOpenOnly]
  )

  const updateTodo = useCallback(
    async (
      id: number,
      updates: {
        title?: string
        description?: string | null
        starts_at?: Date | null
        ends_at?: Date | null
        is_all_day?: number
        done?: number
      }
    ) => {
      const completing = listOpenOnly && updates.done === 1
      mutate(
        (current) => {
          if (!current) return current
          if (completing) {
            return { data: current.data.filter((t) => t.id !== id) }
          }
          return {
            data: current.data.map((t) =>
              t.id === id ? optimisticTodoMerge(t, updates) : t
            ),
          }
        },
        { revalidate: false }
      )
      try {
        await patchApiV1TodosId(id, updatesToPatch(updates))
        await revalidateAllTodoLists()
      } catch (err) {
        await revalidateAllTodoLists()
        throw err
      }
    },
    [mutate, listOpenOnly]
  )

  const deleteTodo = useCallback(
    async (id: number) => {
      mutate(
        (current) => {
          if (!current) return current
          return { data: current.data.filter((t) => t.id !== id) }
        },
        { revalidate: false }
      )
      try {
        await deleteApiV1TodosId(id)
        await revalidateAllTodoLists()
      } catch (err) {
        await revalidateAllTodoLists()
        throw err
      }
    },
    [mutate]
  )

  return { todos, isLoading, error, createTodo, updateTodo, toggleDone, deleteTodo, mutate }
}
