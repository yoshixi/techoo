import {
  getSmartPlanRange,
  latestOpenTimedMarkerOnDay,
  defaultTimedRangeForDay,
  PLAN_DEFAULT_DURATION_MIN,
} from '../../lib/planDefaultStart';
import type { Todo } from '@/gen/api/schemas';

const DAY_SEC = 86400;

function iso(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

function todo(partial: Partial<Todo> & Pick<Todo, 'id'>): Todo {
  return {
    title: 't',
    starts_at: null,
    ends_at: null,
    is_all_day: 0,
    done: 0,
    done_at: null,
    created_at: iso(0),
    ...partial,
  };
}

describe('planDefaultStart', () => {
  const dayFromSec = 1_700_000_000;
  const dayToSec = dayFromSec + DAY_SEC;
  const dayStart = new Date(dayFromSec * 1000);
  const dayEndExclusive = new Date(dayToSec * 1000);

  describe('latestOpenTimedMarkerOnDay', () => {
    it('returns null when no timed open todos', () => {
      expect(latestOpenTimedMarkerOnDay([], dayStart, dayEndExclusive)).toBeNull();
      expect(
        latestOpenTimedMarkerOnDay([todo({ id: 1, starts_at: null })], dayStart, dayEndExclusive)
      ).toBeNull();
    });

    it('uses ends_at when present', () => {
      const todos = [
        todo({ id: 2, starts_at: iso(dayFromSec + 3600), ends_at: iso(dayFromSec + 7200) }),
        todo({ id: 3, starts_at: iso(dayFromSec + 4000), ends_at: iso(dayFromSec + 9000) }),
      ];
      expect(latestOpenTimedMarkerOnDay(todos, dayStart, dayEndExclusive)).toBe(
        (dayFromSec + 9000) * 1000
      );
    });

    it('falls back to starts_at when no ends_at', () => {
      const todos = [todo({ id: 4, starts_at: iso(dayFromSec + 5000), ends_at: null })];
      expect(latestOpenTimedMarkerOnDay(todos, dayStart, dayEndExclusive)).toBe(
        (dayFromSec + 5000) * 1000
      );
    });

    it('ignores all-day and done', () => {
      const todos = [
        todo({ id: 5, starts_at: iso(dayFromSec + 100), ends_at: iso(dayFromSec + 200), done: 1 }),
        todo({ id: 6, starts_at: iso(dayFromSec + 1000), is_all_day: 1 }),
        todo({ id: 7, starts_at: iso(dayFromSec + 3000), ends_at: iso(dayFromSec + 4000) }),
      ];
      expect(latestOpenTimedMarkerOnDay(todos, dayStart, dayEndExclusive)).toBe(
        (dayFromSec + 4000) * 1000
      );
    });
  });

  describe('getSmartPlanRange', () => {
    it('uses 9am for non-today', () => {
      const nowMs = (dayFromSec + 10 * 3600) * 1000;
      const { start, end } = getSmartPlanRange(
        false,
        dayStart,
        dayEndExclusive,
        [],
        nowMs,
        PLAN_DEFAULT_DURATION_MIN
      );
      expect(start.getHours()).toBe(9);
      expect(start.getMinutes()).toBe(0);
      expect(end.getTime() - start.getTime()).toBe(PLAN_DEFAULT_DURATION_MIN * 60 * 1000);
    });

    it('uses now when no tasks and viewing today', () => {
      const nowSec = dayFromSec + 15 * 3600;
      const { start } = getSmartPlanRange(
        true,
        dayStart,
        dayEndExclusive,
        [],
        nowSec * 1000,
        PLAN_DEFAULT_DURATION_MIN
      );
      expect(Math.floor(start.getTime() / 1000)).toBe(nowSec);
    });

    it('uses max(now, lastMarker) when last ends before now', () => {
      const nowSec = dayFromSec + 16 * 3600;
      const todos = [
        todo({ id: 8, starts_at: iso(dayFromSec + 3600), ends_at: iso(dayFromSec + 7200) }),
      ];
      const { start } = getSmartPlanRange(
        true,
        dayStart,
        dayEndExclusive,
        todos,
        nowSec * 1000,
        PLAN_DEFAULT_DURATION_MIN
      );
      expect(Math.floor(start.getTime() / 1000)).toBe(nowSec);
    });

    it('uses lastMarker when now is before last block end', () => {
      const nowSec = dayFromSec + 8 * 3600;
      const lastEnd = dayFromSec + 14 * 3600;
      const todos = [
        todo({ id: 9, starts_at: iso(dayFromSec + 3600), ends_at: iso(lastEnd) }),
      ];
      const { start } = getSmartPlanRange(
        true,
        dayStart,
        dayEndExclusive,
        todos,
        nowSec * 1000,
        PLAN_DEFAULT_DURATION_MIN
      );
      expect(Math.floor(start.getTime() / 1000)).toBe(lastEnd);
    });
  });

  describe('defaultTimedRangeForDay', () => {
    it('anchors at local midnight of anchor day then 9am', () => {
      const { start } = defaultTimedRangeForDay(new Date(dayFromSec * 1000), 30);
      const midnight = new Date(dayFromSec * 1000);
      expect(start.getFullYear()).toBe(midnight.getFullYear());
      expect(start.getMonth()).toBe(midnight.getMonth());
      expect(start.getDate()).toBe(midnight.getDate());
      expect(start.getHours()).toBe(9);
    });
  });
});
