import { useMemo } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { dayBoundsLocal } from '@/lib/dayBounds'
import {
  filterTodosForList,
  recentRangeBounds,
  sortTodosForList,
} from '@/lib/todoListFilters'
import type { TodosListFilters } from '@/lib/todosScreenIntent'

function listFetchOptions(filters: TodosListFilters, selectedDay: Date) {
  if (filters.scope === 'allOpen') {
    if (filters.status === 'open') return { showAll: true as const }
    if (filters.status === 'done') return { includeDone: true as const }
    return { fetchAll: true as const }
  }
  const range =
    filters.scope === 'thisDay'
      ? (() => {
          const day = dayBoundsLocal(selectedDay)
          return { from: day.start, to: day.endExclusive }
        })()
      : recentRangeBounds(selectedDay)
  return {
    from: range.from,
    to: range.to,
    includeDone: filters.status !== 'open',
    includeCompletedInRange: false,
  }
}

export function useTodosListView(selectedDay: Date, filters: TodosListFilters) {
  const fetchOptions = useMemo(
    () => listFetchOptions(filters, selectedDay),
    [filters, selectedDay]
  )
  const { todos, isLoading, toggleDone, mutate } = useTodos(fetchOptions)

  const filtered = useMemo(
    () => sortTodosForList(filterTodosForList(todos, filters, selectedDay), filters.status),
    [todos, filters, selectedDay]
  )

  return { todos: filtered, isLoading, toggleDone, mutate }
}
