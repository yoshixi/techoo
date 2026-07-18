import { pickRunningTodo, pickNextTimedTodo, DEFAULT_TODO_DURATION_SEC } from '../../lib/runningTodo';
import type { Todo } from '@/gen/api/schemas';

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

describe('runningTodo', () => {
  describe('pickRunningTodo', () => {
    it('returns null when empty', () => {
      expect(pickRunningTodo([], new Date(100_000))).toBeNull();
    });

    it('picks timed todo in window', () => {
      const a = todo({ id: 1, starts_at: iso(100), ends_at: iso(200) });
      expect(pickRunningTodo([a], new Date(150_000))).toEqual(a);
    });

    it('uses default duration when ends_at missing', () => {
      const a = todo({ id: 1, starts_at: iso(100), ends_at: null });
      expect(pickRunningTodo([a], new Date(100_000))).toEqual(a);
      expect(pickRunningTodo([a], new Date(100_000 + (DEFAULT_TODO_DURATION_SEC - 1) * 1000))).toEqual(a);
      expect(pickRunningTodo([a], new Date(100_000 + DEFAULT_TODO_DURATION_SEC * 1000))).toBeNull();
    });

    it('picks earliest start when two overlap', () => {
      const early = todo({ id: 2, starts_at: iso(100), ends_at: iso(300) });
      const late = todo({ id: 3, starts_at: iso(150), ends_at: iso(400) });
      expect(pickRunningTodo([late, early], new Date(200_000))).toEqual(early);
    });

    it('falls back to first all-day when no timed match', () => {
      const ad = todo({ id: 4, is_all_day: 1, starts_at: null });
      expect(pickRunningTodo([ad], new Date(999_000_000))).toEqual(ad);
    });

    it('ignores done', () => {
      const a = todo({ id: 1, starts_at: iso(100), ends_at: iso(200), done: 1 });
      expect(pickRunningTodo([a], new Date(150_000))).toBeNull();
    });
  });

  describe('pickNextTimedTodo', () => {
    it('returns earliest future timed', () => {
      const t1 = todo({ id: 10, starts_at: iso(200) });
      const t2 = todo({ id: 11, starts_at: iso(150) });
      expect(pickNextTimedTodo([t1, t2], new Date(100_000))).toEqual(t2);
    });

    it('returns null when none in future', () => {
      const t = todo({ id: 12, starts_at: iso(100) });
      expect(pickNextTimedTodo([t], new Date(200_000))).toBeNull();
    });
  });
});
