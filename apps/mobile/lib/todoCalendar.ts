import type { Todo } from '@/gen/api/schemas'

/** Minimal shape for hour-grid layout (ISO times, same as legacy Task calendar fields). */
export type CalendarTimedItem = {
  id: number
  title: string
  startAt: string
  endAt: string | null
  done: number
}

/** Skip all-day and unscheduled todos on the time grid. */
export function todoToCalendarTimedItem(todo: Todo): CalendarTimedItem | null {
  if (todo.is_all_day === 1) return null
  if (todo.starts_at == null) return null
  return {
    id: todo.id,
    title: todo.title,
    startAt: todo.starts_at,
    endAt: todo.ends_at,
    done: todo.done,
  }
}
