import { startOfLocalDay } from '@/lib/dayBounds'

export type TodosViewMode = 'timeline' | 'list'

export type TodosPostCreateIntent =
  | { kind: 'list'; filters?: Partial<TodosListFilters> }
  | {
      kind: 'timeline'
      day: Date
      scrollToHour?: number
      scrollToMinute?: number
    }

export type TodosStatusFilter = 'open' | 'done' | 'all'
export type TodosScheduleFilter = 'all' | 'timed' | 'later' | 'allDay'
export type TodosScopeFilter = 'thisDay' | 'allOpen' | 'recent'

export type TodosListFilters = {
  status: TodosStatusFilter
  schedule: TodosScheduleFilter
  scope: TodosScopeFilter
}

export const DEFAULT_LIST_FILTERS: TodosListFilters = {
  status: 'open',
  schedule: 'all',
  scope: 'thisDay',
}

export const LATER_LIST_FILTERS: TodosListFilters = {
  status: 'open',
  schedule: 'later',
  scope: 'allOpen',
}

export const DONE_TODAY_LIST_FILTERS: TodosListFilters = {
  status: 'done',
  schedule: 'all',
  scope: 'thisDay',
}

let pendingIntent: TodosPostCreateIntent | null = null

export function setTodosPostCreateIntent(intent: TodosPostCreateIntent): void {
  pendingIntent = intent
}

export function consumeTodosPostCreateIntent(): TodosPostCreateIntent | null {
  const intent = pendingIntent
  pendingIntent = null
  return intent
}

/** Build navigation intent after creating a todo from the composer. */
export function postCreateIntentForTodo(input: {
  mode: 'later' | 'timed' | 'allDay'
  startsAt?: Date
}): TodosPostCreateIntent {
  if (input.mode === 'later') {
    return { kind: 'list', filters: LATER_LIST_FILTERS }
  }
  const day = startOfLocalDay(input.startsAt ?? new Date())
  if (input.mode === 'allDay') {
    return { kind: 'timeline', day }
  }
  const start = input.startsAt ?? new Date()
  return {
    kind: 'timeline',
    day,
    scrollToHour: start.getHours(),
    scrollToMinute: start.getMinutes(),
  }
}
