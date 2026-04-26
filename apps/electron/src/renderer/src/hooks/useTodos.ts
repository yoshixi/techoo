import {
  useGetApiV1Todos,
  postApiV1Todos,
  patchApiV1TodosId,
  deleteApiV1TodosId
} from '../gen/api/endpoints/techooAPI.gen'
import type { ErrorResponse, GetApiV1TodosParams, Todo } from '../gen/api/schemas'
import { useCallback, useMemo } from 'react'

/** Match backend `MAX_LIST_LIMIT` so the client can request the full allowed page. */
const TODO_LIST_LIMIT = 500

export function useTodos(options?: {
  from?: number
  to?: number
  showAll?: boolean
  /**
   * When fetching a day/range (`from`+`to`), include completed todos.
   * Default true (Today tab calendar needs them). ToDo list passes false to hide completed unless toggled.
   */
  includeCompletedInRange?: boolean
  /** All todos for the tenant (no date or done filter). Use sparingly. */
  fetchAll?: boolean
}): {
  todos: Todo[]
  isLoading: boolean
  error: ErrorResponse | undefined
  createTodo: (title: string, startsAt?: number, endsAt?: number) => Promise<void>
  updateTodo: (
    id: number,
    updates: {
      title?: string
      description?: string | null
      starts_at?: number | null
      ends_at?: number | null
      is_all_day?: number
      done?: number
    }
  ) => Promise<void>
  toggleDone: (id: number, currentDone: number) => Promise<void>
  deleteTodo: (id: number) => Promise<void>
  mutate: ReturnType<typeof useGetApiV1Todos>['mutate']
} {
  const params: GetApiV1TodosParams | undefined = useMemo(() => {
    if (options?.fetchAll) {
      return { limit: TODO_LIST_LIMIT }
    }
    if (options?.showAll) {
      return { done: 'false' as const, limit: TODO_LIST_LIMIT }
    }
    if (options?.from != null && options?.to != null) {
      const fromIso = new Date(options.from * 1000).toISOString()
      const toIso = new Date(options.to * 1000).toISOString()
      const includeCompleted = options.includeCompletedInRange !== false
      if (includeCompleted) {
        return { from: fromIso, to: toIso, limit: TODO_LIST_LIMIT }
      }
      return { from: fromIso, to: toIso, done: 'false' as const, limit: TODO_LIST_LIMIT }
    }
    return { done: 'false' as const, limit: TODO_LIST_LIMIT }
  }, [options?.from, options?.to, options?.showAll, options?.fetchAll, options?.includeCompletedInRange])

  const { data, isLoading, error, mutate } = useGetApiV1Todos(params)

  const todos = data?.data ?? []

  const mergeTodoFromServer = useCallback(
    (id: number, server: Todo) => {
      mutate(
        (current) => {
          if (!current) return current
          return {
            data: current.data.map((t) => (t.id === id ? server : t))
          }
        },
        { revalidate: false }
      )
    },
    [mutate]
  )

  const stripTempTodos = useCallback(
    (current: { data: Todo[] } | undefined, server: Todo) => {
      if (!current) return { data: [server] }
      const noTemp = current.data.filter((t) => t.id > 0)
      return { data: [...noTemp, server] }
    },
    []
  )

  const createTodo = useCallback(
    async (title: string, startsAt?: number, endsAt?: number) => {
      const optimisticTodo: Todo = {
        id: -Math.abs(Date.now()),
        title,
        description: null,
        starts_at: startsAt != null ? new Date(startsAt * 1000).toISOString() : null,
        ends_at: endsAt != null ? new Date(endsAt * 1000).toISOString() : null,
        is_all_day: 0,
        done: 0,
        done_at: null,
        created_at: new Date().toISOString()
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
          starts_at: startsAt != null ? new Date(startsAt * 1000).toISOString() : undefined,
          ends_at: endsAt != null ? new Date(endsAt * 1000).toISOString() : undefined
        })
        mutate((current) => stripTempTodos(current, res.data), { revalidate: false })
      } catch {
        await mutate()
      }
    },
    [mutate, stripTempTodos]
  )

  const toggleDone = useCallback(
    async (id: number, currentDone: number) => {
      const newDone = currentDone === 1 ? 0 : 1

      mutate(
        (current) => {
          if (!current) return current
          return {
            data: current.data.map((t) =>
              t.id === id ? { ...t, done: newDone, done_at: newDone === 1 ? new Date().toISOString() : null } : t
            )
          }
        },
        { revalidate: false }
      )

      try {
        const res = await patchApiV1TodosId(id, { done: newDone })
        mergeTodoFromServer(id, res.data)
      } catch {
        await mutate()
      }
    },
    [mutate, mergeTodoFromServer]
  )

  const updateTodo = useCallback(
    async (
      id: number,
      updates: {
        title?: string
        description?: string | null
        starts_at?: number | null
        ends_at?: number | null
        is_all_day?: number
        done?: number
      }
    ) => {
      const isoUpdates = {
        ...updates,
        starts_at:
          updates.starts_at !== undefined
            ? updates.starts_at != null
              ? new Date(updates.starts_at * 1000).toISOString()
              : null
            : undefined,
        ends_at:
          updates.ends_at !== undefined
            ? updates.ends_at != null
              ? new Date(updates.ends_at * 1000).toISOString()
              : null
            : undefined
      }

      mutate(
        (current) => {
          if (!current) return current
          return {
            data: current.data.map((t) => (t.id === id ? ({ ...t, ...isoUpdates } as Todo) : t))
          }
        },
        { revalidate: false }
      )

      try {
        const res = await patchApiV1TodosId(id, isoUpdates)
        mergeTodoFromServer(id, res.data)
      } catch {
        await mutate()
      }
    },
    [mutate, mergeTodoFromServer]
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
      } catch {
        await mutate()
      }
    },
    [mutate]
  )

  return { todos, isLoading, error, createTodo, updateTodo, toggleDone, deleteTodo, mutate }
}
