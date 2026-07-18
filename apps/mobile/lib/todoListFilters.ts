import type { Todo } from '@/gen/api/schemas'
import { dayBoundsLocal, isSameLocalDay, startOfLocalDay } from '@/lib/dayBounds'
import { addDays } from '@/lib/time'
import type {
  TodosListFilters,
  TodosScheduleFilter,
  TodosScopeFilter,
  TodosStatusFilter,
} from '@/lib/todosScreenIntent'

export function recentRangeBounds(anchorDay: Date): { from: Date; to: Date } {
  const endExclusive = addDays(startOfLocalDay(anchorDay), 1)
  const from = addDays(endExclusive, -14)
  return { from, to: endExclusive }
}

export function matchesScheduleFilter(todo: Todo, schedule: TodosScheduleFilter): boolean {
  if (schedule === 'all') return true
  if (schedule === 'allDay') return todo.is_all_day === 1
  if (schedule === 'later') return todo.is_all_day !== 1 && todo.starts_at == null
  return todo.is_all_day !== 1 && todo.starts_at != null
}

export function matchesStatusFilter(todo: Todo, status: TodosStatusFilter): boolean {
  if (status === 'all') return true
  if (status === 'open') return todo.done === 0
  return todo.done === 1
}

function doneOnLocalDay(todo: Todo, day: Date): boolean {
  if (todo.done !== 1) return false
  const anchor = todo.done_at ?? todo.starts_at ?? todo.created_at
  return isSameLocalDay(new Date(anchor), day)
}

function scheduledOnLocalDay(todo: Todo, day: Date): boolean {
  const { start, endExclusive } = dayBoundsLocal(day)
  const lo = start.getTime()
  const hi = endExclusive.getTime()
  if (todo.is_all_day === 1 && todo.starts_at != null) {
    const s = new Date(todo.starts_at).getTime()
    return s >= lo && s < hi
  }
  if (todo.starts_at == null) return isSameLocalDay(day, new Date())
  const s = new Date(todo.starts_at).getTime()
  return s >= lo && s < hi
}

function inRecentWindow(todo: Todo, anchorDay: Date): boolean {
  const { from, to } = recentRangeBounds(anchorDay)
  const lo = from.getTime()
  const hi = to.getTime()
  if (todo.done === 1) {
    const doneAt = todo.done_at ?? todo.starts_at ?? todo.created_at
    const t = new Date(doneAt).getTime()
    return t >= lo && t < hi
  }
  if (todo.starts_at == null) return isSameLocalDay(anchorDay, new Date())
  const t = new Date(todo.starts_at).getTime()
  return t >= lo && t < hi
}

export function matchesScopeFilter(
  todo: Todo,
  scope: TodosScopeFilter,
  selectedDay: Date
): boolean {
  if (scope === 'allOpen') return true
  if (scope === 'recent') return inRecentWindow(todo, selectedDay)
  if (todo.done === 1) return doneOnLocalDay(todo, selectedDay)
  return scheduledOnLocalDay(todo, selectedDay)
}

export function filterTodosForList(
  todos: Todo[],
  filters: TodosListFilters,
  selectedDay: Date
): Todo[] {
  return todos.filter(
    (t) =>
      matchesStatusFilter(t, filters.status) &&
      matchesScheduleFilter(t, filters.schedule) &&
      matchesScopeFilter(t, filters.scope, selectedDay)
  )
}

export function sortTodosForList(todos: Todo[], status: TodosStatusFilter): Todo[] {
  const list = [...todos]
  if (status === 'done') {
    list.sort((a, b) => {
      const ad = new Date(a.done_at ?? a.created_at).getTime()
      const bd = new Date(b.done_at ?? b.created_at).getTime()
      return bd - ad
    })
    return list
  }
  list.sort((a, b) => {
    const aUnscheduled = a.starts_at == null ? 1 : 0
    const bUnscheduled = b.starts_at == null ? 1 : 0
    if (aUnscheduled !== bUnscheduled) return aUnscheduled - bUnscheduled
    const as = new Date(a.starts_at ?? a.created_at).getTime()
    const bs = new Date(b.starts_at ?? b.created_at).getTime()
    return as - bs
  })
  return list
}

export function listFilterSummary(filters: TodosListFilters): string {
  const status =
    filters.status === 'open' ? 'Open' : filters.status === 'done' ? 'Done' : 'All'
  const schedule =
    filters.schedule === 'all'
      ? null
      : filters.schedule === 'timed'
        ? 'Timed'
        : filters.schedule === 'later'
          ? 'Later'
          : 'All day'
  const scope =
    filters.scope === 'thisDay' ? 'This day' : filters.scope === 'allOpen' ? 'All open' : 'Recent 14d'
  return [status, schedule, scope].filter(Boolean).join(' · ')
}

export function listEmptyMessage(filters: TodosListFilters, selectedDay: Date): string {
  const dayLabel = selectedDay.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (filters.schedule === 'later' && filters.scope === 'allOpen') {
    return 'Nothing in Later.'
  }
  if (filters.status === 'done' && filters.scope === 'thisDay') {
    return `Nothing completed on ${dayLabel}.`
  }
  if (filters.scope === 'recent') {
    return 'No to-dos in the last 14 days for these filters.'
  }
  if (filters.scope === 'allOpen') {
    return 'No open to-dos match these filters.'
  }
  return `No to-dos on ${dayLabel} for these filters.`
}
