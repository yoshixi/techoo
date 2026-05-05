import type { Todo } from '@/gen/api/schemas';

export const PLAN_DEFAULT_DURATION_MIN = 30;

/** Fixed morning default when viewing a day other than today. */
export function defaultTimedRangeForDay(dayStart: Date, durationMin: number): { start: Date; end: Date } {
  const start = new Date(dayStart);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  return { start, end };
}

/**
 * Latest instant among open, timed to-dos scheduled on this local day (for stacking new items).
 * Uses `ends_at ?? starts_at` per task. Skips all-day and unscheduled.
 * Returns milliseconds since epoch, or null.
 */
export function latestOpenTimedMarkerOnDay(
  todos: Todo[],
  dayStart: Date,
  dayEndExclusive: Date
): number | null {
  const lo = dayStart.getTime();
  const hi = dayEndExclusive.getTime();
  let maxMs: number | null = null;
  for (const t of todos) {
    if (t.done !== 0) continue;
    if (t.is_all_day === 1) continue;
    if (t.starts_at == null) continue;
    const startMs = new Date(t.starts_at).getTime();
    if (startMs < lo || startMs >= hi) continue;
    const markerMs = t.ends_at != null ? new Date(t.ends_at).getTime() : startMs;
    if (maxMs == null || markerMs > maxMs) maxMs = markerMs;
  }
  return maxMs;
}

/**
 * Default start/end for the Plan composer.
 *
 * When **not** viewing today: 9:00 on that day + duration.
 * When **viewing today**: `start = max(now, latestMarker)` where `latestMarker` is the greatest
 * `ends_at ?? starts_at` among open timed tasks on this day; if none, use `now`.
 */
export function getSmartPlanRange(
  viewingToday: boolean,
  dayStart: Date,
  dayEndExclusive: Date,
  todos: Todo[],
  nowMs: number,
  durationMin: number
): { start: Date; end: Date } {
  if (!viewingToday) {
    return defaultTimedRangeForDay(dayStart, durationMin);
  }

  const lastLatestMs = latestOpenTimedMarkerOnDay(todos, dayStart, dayEndExclusive);
  const startMs = lastLatestMs == null ? nowMs : Math.max(nowMs, lastLatestMs);
  const start = new Date(startMs);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  return { start, end };
}
