import type { Todo } from '@/gen/api/schemas'
import { startOfLocalDay } from '@/lib/dayBounds'

export type TodoScheduleMode = 'later' | 'timed' | 'allDay'
export type DurationPreset = '15' | '30' | '60' | 'custom'

export function mergeDateAndTime(date: Date, time: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0
  )
}

export function scheduleModeFromTodo(todo: Todo): TodoScheduleMode {
  if (todo.is_all_day === 1) return 'allDay'
  if (todo.starts_at == null) return 'later'
  return 'timed'
}

export function initialDateFromTodo(todo: Todo): Date {
  if (todo.starts_at != null) return startOfLocalDay(new Date(todo.starts_at))
  if (todo.created_at != null) return startOfLocalDay(new Date(todo.created_at))
  return startOfLocalDay(new Date())
}

export function initialStartTimeFromTodo(todo: Todo): Date {
  if (todo.starts_at != null) return new Date(todo.starts_at)
  const now = new Date()
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
  return now
}

export function durationStateFromTodo(todo: Todo): {
  preset: DurationPreset
  customMin: string
} {
  if (todo.starts_at == null || todo.ends_at == null) {
    return { preset: '30', customMin: '45' }
  }
  const mins = Math.max(
    1,
    Math.round((new Date(todo.ends_at).getTime() - new Date(todo.starts_at).getTime()) / 60_000)
  )
  if (mins === 15) return { preset: '15', customMin: '45' }
  if (mins === 30) return { preset: '30', customMin: '45' }
  if (mins === 60) return { preset: '60', customMin: '45' }
  return { preset: 'custom', customMin: String(mins) }
}

export function durationMinutes(preset: DurationPreset, customDurationMin: string): number {
  if (preset !== 'custom') return Number(preset)
  const parsed = Number(customDurationMin)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.floor(parsed))
}

export type ScheduleDraft = {
  mode: TodoScheduleMode
  date: Date
  startTime: Date
  durationPreset: DurationPreset
  customDurationMin: string
}

export function scheduleDraftFromTodo(todo: Todo): ScheduleDraft {
  const duration = durationStateFromTodo(todo)
  return {
    mode: scheduleModeFromTodo(todo),
    date: initialDateFromTodo(todo),
    startTime: initialStartTimeFromTodo(todo),
    durationPreset: duration.preset,
    customDurationMin: duration.customMin,
  }
}

function schedulePayloadKey(payload: ReturnType<typeof buildScheduleUpdate>): string {
  const start = payload.starts_at?.getTime() ?? 'null'
  const end = payload.ends_at?.getTime() ?? 'null'
  return `${payload.is_all_day}|${start}|${end}`
}

export function scheduleDraftEqualsTodo(draft: ScheduleDraft, todo: Todo): boolean {
  const draftPayload = buildScheduleUpdate(
    draft.mode,
    draft.date,
    draft.startTime,
    durationMinutes(draft.durationPreset, draft.customDurationMin)
  )
  const saved = scheduleDraftFromTodo(todo)
  const savedPayload = buildScheduleUpdate(
    saved.mode,
    saved.date,
    saved.startTime,
    durationMinutes(saved.durationPreset, saved.customDurationMin)
  )
  return schedulePayloadKey(draftPayload) === schedulePayloadKey(savedPayload)
}

export function buildScheduleUpdate(
  mode: TodoScheduleMode,
  date: Date,
  startTime: Date,
  durationMin: number
): {
  is_all_day: number
  starts_at: Date | null
  ends_at: Date | null
} {
  if (mode === 'later') {
    return { is_all_day: 0, starts_at: null, ends_at: null }
  }
  if (mode === 'allDay') {
    const dayStart = startOfLocalDay(date)
    return { is_all_day: 1, starts_at: dayStart, ends_at: null }
  }
  const start = mergeDateAndTime(date, startTime)
  const safeDuration = Math.max(1, durationMin)
  const end = new Date(start.getTime() + safeDuration * 60_000)
  return { is_all_day: 0, starts_at: start, ends_at: end }
}
