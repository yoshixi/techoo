/**
 * Shared calendar utilities for mobile app
 * Ported from apps/electron/src/renderer/src/lib/calendar-utils.ts
 */
import type { Task } from '@/gen/api/schemas';

// ============================================================================
// Constants
// ============================================================================

/** Total minutes in a day (24 hours * 60 minutes) */
export const MINUTES_PER_DAY = 24 * 60;

/** Default task duration when endAt is not specified */
export const DEFAULT_DURATION_MINUTES = 30;

/** Milliseconds in a day, used for date calculations */
export const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Internal representation of a task positioned on the calendar grid.
 * Contains layout information for rendering (lane assignment, slot positions).
 */
export type TaskLayout = {
  task: Task;
  /** Which day column (0 for day view, 0-6 for week view) */
  dayIndex: number;
  /** Starting slot index (inclusive) */
  startSlot: number;
  /** Ending slot index (exclusive) */
  endSlot: number;
  /** Horizontal lane for overlapping tasks (0-based) */
  lane: number;
  /** Total number of lanes in this time range */
  laneCount: number;
  /** Parsed start date */
  startDate: Date;
  /** Parsed/computed end date */
  endDate: Date;
};

// ============================================================================
// Utility Functions
// ============================================================================

/** Clamps a value between min and max bounds */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Returns midnight (00:00:00) of the given date */
export const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Computes the end date for a task.
 * If endAt is provided and valid, uses that; otherwise defaults to start + DEFAULT_DURATION_MINUTES.
 */
export const computeTaskEnd = (start: Date, endAt?: string | null): Date => {
  if (endAt) {
    const parsed = new Date(endAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
};

/**
 * Assigns horizontal lanes to overlapping tasks using a greedy algorithm.
 * Tasks are sorted by start time, then assigned to the first available lane
 * that doesn't overlap with their time range.
 *
 * @param tasks - Array of TaskLayout items to assign lanes to
 * @returns The same tasks with lane and laneCount properties populated
 */
export const assignLanes = (tasks: TaskLayout[]): TaskLayout[] => {
  // Track the end slot of the last task in each lane
  const lanesEnd: number[] = [];

  // Sort by start time (then by end time for same start)
  const sorted = [...tasks].sort((a, b) => {
    if (a.startSlot === b.startSlot) return a.endSlot - b.endSlot;
    return a.startSlot - b.startSlot;
  });

  sorted.forEach((item) => {
    // Find first lane where this task fits (no overlap)
    let laneIndex = lanesEnd.findIndex((endSlot) => item.startSlot >= endSlot);
    if (laneIndex === -1) {
      // No available lane, create a new one
      laneIndex = lanesEnd.length;
      lanesEnd.push(item.endSlot);
    } else {
      // Reuse this lane and update its end slot
      lanesEnd[laneIndex] = item.endSlot;
    }
    item.lane = laneIndex;
  });

  // Set laneCount on all items so they know how wide to render
  const laneCount = Math.max(lanesEnd.length, 1);
  return sorted.map((item) => ({ ...item, laneCount }));
};

/**
 * Calculates task layouts for a given day.
 *
 * @param tasks - Array of tasks to layout
 * @param baseDate - The base date for the day
 * @param slotMinutes - Minutes per slot (default 15)
 * @returns Array of TaskLayout items with lane assignments
 */
export const calculateTaskLayoutsForDay = (
  tasks: Task[],
  baseDate: Date,
  slotMinutes: number = 15
): TaskLayout[] => {
  const slotCount = MINUTES_PER_DAY / slotMinutes;
  const layouts: TaskLayout[] = [];

  tasks.forEach((task) => {
    if (!task.startAt) return;

    const startDate = new Date(task.startAt);
    if (Number.isNaN(startDate.getTime())) return;

    const endDateRaw = computeTaskEnd(startDate, task.endAt);
    const baseTime = startOfDay(baseDate).getTime();
    const startDayTime = startOfDay(startDate).getTime();

    // Skip tasks not on this day
    if (startDayTime !== baseTime) return;

    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    let endDate = endDateRaw;
    if (endDate <= startDate) {
      endDate = new Date(startDate.getTime() + slotMinutes * 60 * 1000);
    }
    const endMinutesRaw = endDate.getHours() * 60 + endDate.getMinutes();
    const endMinutes = clamp(endMinutesRaw, 0, MINUTES_PER_DAY);

    const startSlot = clamp(Math.floor(startMinutes / slotMinutes), 0, slotCount - 1);
    const endSlot = clamp(Math.ceil(endMinutes / slotMinutes), startSlot + 1, slotCount);

    layouts.push({
      task,
      dayIndex: 0,
      startSlot,
      endSlot,
      lane: 0,
      laneCount: 1,
      startDate,
      endDate,
    });
  });

  return assignLanes(layouts);
};
