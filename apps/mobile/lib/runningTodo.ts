import type { Todo } from '@/gen/api/schemas';

/** Same default block length as Electron `TodayView` / calendar. */
export const DEFAULT_TODO_DURATION_SEC = 30 * 60;

/**
 * Open todo whose time window contains `now`, or first all-day open todo.
 * Timed window uses `ends_at ?? starts_at + DEFAULT_TODO_DURATION_SEC`.
 * If several timed todos overlap, picks the one with the earliest `starts_at`.
 */
export function pickRunningTodo(todos: Todo[], now: Date): Todo | null {
  const nowMs = now.getTime();
  const open = todos.filter((t) => t.done === 0);
  const inTimedWindow: Todo[] = [];
  for (const t of open) {
    if (t.is_all_day === 1) continue;
    if (t.starts_at == null) continue;
    const startMs = new Date(t.starts_at).getTime();
    const endMs =
      t.ends_at != null
        ? new Date(t.ends_at).getTime()
        : startMs + DEFAULT_TODO_DURATION_SEC * 1000;
    if (startMs <= nowMs && nowMs < endMs) inTimedWindow.push(t);
  }
  if (inTimedWindow.length > 0) {
    return inTimedWindow.reduce((a, b) =>
      new Date(a.starts_at!).getTime() <= new Date(b.starts_at!).getTime() ? a : b
    );
  }
  const allDay = open.filter((t) => t.is_all_day === 1);
  if (allDay.length > 0) return allDay[0];
  return null;
}

/** Earliest future timed open todo (by `starts_at`), or null. */
export function pickNextTimedTodo(todos: Todo[], now: Date): Todo | null {
  const nowMs = now.getTime();
  const open = todos.filter((t) => t.done === 0 && t.is_all_day !== 1 && t.starts_at != null);
  const future = open.filter((t) => new Date(t.starts_at!).getTime() > nowMs);
  if (future.length === 0) return null;
  return future.reduce((a, b) =>
    new Date(a.starts_at!).getTime() <= new Date(b.starts_at!).getTime() ? a : b
  );
}
