import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Check, Clock } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import type { Todo } from '@/gen/api/schemas';
import { dayBoundsLocal, isSameLocalDay } from '@/lib/dayBounds';
import { formatTodoClockTime } from '@/lib/time';
import { useDailyHourWindow } from '@/hooks/useDailyHourWindow';
import { usePeriodicNow } from '@/hooks/usePeriodicNow';

/** Pixels per hour on the schedule grid (matches calendar scale). */
export const HOUR_ROW_MIN_HEIGHT = 64;

const TIME_LABEL_WIDTH = 48;
const RAIL_WIDTH = 20;
const TODO_AREA_LEFT = TIME_LABEL_WIDTH + RAIL_WIDTH + 8;
/** Floor for very short blocks — kept low so duration drives height. */
const MIN_TODO_BLOCK_HEIGHT = 22;
const DEFAULT_TODO_DURATION_MIN = 30;
const COMPACT_TODO_BLOCK_HEIGHT = 36;

const HOUR_DOT_SIZE = 8;
const HOUR_DOT_MARGIN_TOP = 4;
const RAIL_LINE_LEFT = TIME_LABEL_WIDTH + (RAIL_WIDTH - 1) / 2;
const HOUR_DOT_LEFT = TIME_LABEL_WIDTH + (RAIL_WIDTH - HOUR_DOT_SIZE) / 2;

function hourDotCenterY(hourIndex: number, hourHeight: number): number {
  return hourIndex * hourHeight + HOUR_DOT_MARGIN_TOP + HOUR_DOT_SIZE / 2;
}

export type TimelineScrollTarget = {
  hour: number;
  minute: number;
} | null;

function wakeRelativeMinutes(hour: number, minute: number, wakeHour: number): number {
  return hour * 60 + minute - wakeHour * 60;
}

function yForClockTime(
  hour: number,
  minute: number,
  wakeHour: number,
  hourHeight: number
): number {
  return (wakeRelativeMinutes(hour, minute, wakeHour) / 60) * hourHeight;
}

function durationHeight(minutes: number, hourHeight: number): number {
  return (minutes / 60) * hourHeight;
}

function todoBlockHeight(t: Todo, hourHeight: number): number {
  if (t.starts_at != null && t.ends_at != null) {
    const mins = Math.max(
      1,
      (new Date(t.ends_at).getTime() - new Date(t.starts_at).getTime()) / 60_000
    );
    return Math.max(MIN_TODO_BLOCK_HEIGHT, durationHeight(mins, hourHeight));
  }
  return Math.max(MIN_TODO_BLOCK_HEIGHT, durationHeight(DEFAULT_TODO_DURATION_MIN, hourHeight));
}

function todoBlockLayout(
  t: Todo,
  wakeHour: number,
  bedHour: number,
  hourHeight: number
): { top: number; height: number } {
  const start = new Date(t.starts_at!);
  let top = yForClockTime(start.getHours(), start.getMinutes(), wakeHour, hourHeight);
  let height = todoBlockHeight(t, hourHeight);
  const gridHeight = (bedHour - wakeHour + 1) * hourHeight;

  if (top < 0) {
    height += top;
    top = 0;
  }
  if (top + height > gridHeight) {
    height = gridHeight - top;
  }
  return { top, height: Math.max(height, MIN_TODO_BLOCK_HEIGHT) };
}

function todoScheduleClockLabel(t: Todo): string {
  if (t.starts_at != null) {
    const start = formatTodoClockTime(t.starts_at);
    if (t.ends_at != null) return `${start} – ${formatTodoClockTime(t.ends_at)}`;
    return start;
  }
  return 'No time';
}

function sortTodosForPlan(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    const as = new Date(a.starts_at ?? a.created_at).getTime();
    const bs = new Date(b.starts_at ?? b.created_at).getTime();
    return as - bs;
  });
}

export function TodosTimelineView({
  selectedDay,
  todos,
  isLoading,
  refreshing,
  onRefresh,
  toggleDone,
  onOpenTodo,
  bottomInset,
  scrollTarget,
  onScrollTargetHandled,
}: {
  selectedDay: Date;
  todos: Todo[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  toggleDone: (id: number, done: number) => Promise<void>;
  onOpenTodo: (todo: Todo) => void;
  bottomInset: number;
  scrollTarget: TimelineScrollTarget;
  onScrollTargetHandled?: () => void;
}) {
  const now = usePeriodicNow(60_000);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollViewportHeight = useRef(0);
  const allDaySectionHeight = useRef(0);
  const { wakeHour, bedHour } = useDailyHourWindow();
  const bounds = useMemo(() => dayBoundsLocal(selectedDay), [selectedDay]);
  const viewingToday = isSameLocalDay(selectedDay, new Date());
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const dayScopedTodos = useMemo(() => {
    const lo = bounds.start.getTime();
    const hi = bounds.endExclusive.getTime();
    return todos.filter((t) => {
      if (t.done === 1) return false;
      if (t.starts_at == null) return false;
      if (t.is_all_day === 1) {
        const s = new Date(t.starts_at).getTime();
        return s >= lo && s < hi;
      }
      const s = new Date(t.starts_at).getTime();
      return s >= lo && s < hi;
    });
  }, [todos, bounds.start, bounds.endExclusive]);

  const sortedTodos = useMemo(() => sortTodosForPlan(dayScopedTodos), [dayScopedTodos]);
  const allDayTodos = useMemo(() => sortedTodos.filter((t) => t.is_all_day === 1), [sortedTodos]);
  const timedTodos = useMemo(
    () => sortedTodos.filter((t) => t.is_all_day !== 1 && t.starts_at != null),
    [sortedTodos]
  );
  const hours = useMemo(
    () => Array.from({ length: bedHour - wakeHour + 1 }, (_, i) => wakeHour + i),
    [wakeHour, bedHour]
  );
  const gridHeight = hours.length * HOUR_ROW_MIN_HEIGHT;
  const nowLineTop = yForClockTime(currentHour, currentMinute, wakeHour, HOUR_ROW_MIN_HEIGHT);

  const scrollToY = useCallback(
    (hour: number, minute: number) => {
      if (scrollViewportHeight.current <= 0) return;
      if (hour < wakeHour || hour > bedHour) return;
      const y =
        allDaySectionHeight.current +
        yForClockTime(hour, minute, wakeHour, HOUR_ROW_MIN_HEIGHT);
      const scrollY = Math.max(0, y - scrollViewportHeight.current / 2);
      scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
    },
    [wakeHour, bedHour]
  );

  const scrollToNow = useCallback(() => {
    if (!viewingToday) return;
    scrollToY(currentHour, currentMinute);
  }, [viewingToday, scrollToY, currentHour, currentMinute]);

  useFocusEffect(
    useCallback(() => {
      if (scrollTarget) return;
      const timer = setTimeout(scrollToNow, 100);
      return () => clearTimeout(timer);
    }, [scrollToNow, scrollTarget])
  );

  useEffect(() => {
    if (isLoading || scrollTarget) return;
    const timer = setTimeout(scrollToNow, 100);
    return () => clearTimeout(timer);
  }, [isLoading, scrollToNow, selectedDay, scrollTarget]);

  useEffect(() => {
    if (!scrollTarget || isLoading) return;
    const timer = setTimeout(() => {
      scrollToY(scrollTarget.hour, scrollTarget.minute);
      onScrollTargetHandled?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [scrollTarget, isLoading, scrollToY, onScrollTargetHandled]);

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1 px-4"
      onLayout={(event) => {
        scrollViewportHeight.current = event.nativeEvent.layout.height;
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: Math.max(bottomInset + 84, 120) }}
    >
      {isLoading ? <ActivityIndicator className="py-8" /> : null}
      {!isLoading && sortedTodos.length === 0 ? (
        <Text className="py-6 text-sm text-muted-foreground">No timed to-dos for this day yet.</Text>
      ) : null}

      {!isLoading && allDayTodos.length > 0 ? (
        <View
          className="mb-5 rounded-2xl bg-muted/20 px-3 py-3"
          onLayout={(event) => {
            allDaySectionHeight.current = event.nativeEvent.layout.height + 20;
          }}
        >
          <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            All day
          </Text>
          <View className="gap-2">
            {allDayTodos.map((t) => (
              <View
                key={t.id}
                className="flex-row items-center gap-3 rounded-xl bg-card/60 px-3 py-3 active:opacity-80"
              >
                <Pressable
                  onPress={() =>
                    void toggleDone(t.id, t.done).catch(() => {
                      /* surfaced in customInstance */
                    })
                  }
                  className="h-9 w-9 items-center justify-center rounded-full bg-muted/70"
                >
                  {t.done === 1 ? <Check size={18} className="text-green-600" /> : null}
                </Pressable>
                <Pressable onPress={() => onOpenTodo(t)} className="min-w-0 flex-1">
                  <Text className="text-sm text-foreground">{t.title}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!isLoading ? (
        <View className="relative mb-5" style={{ height: gridHeight }}>
          {hours.length > 1 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: RAIL_LINE_LEFT,
                top: hourDotCenterY(0, HOUR_ROW_MIN_HEIGHT),
                height:
                  hourDotCenterY(hours.length - 1, HOUR_ROW_MIN_HEIGHT) -
                  hourDotCenterY(0, HOUR_ROW_MIN_HEIGHT),
                width: 1,
                zIndex: 1,
              }}
              className="bg-border"
            />
          ) : null}

          {hours.map((hour, idx) => {
            const top = idx * HOUR_ROW_MIN_HEIGHT;
            return (
              <View
                key={hour}
                pointerEvents="none"
                style={{ position: 'absolute', left: 0, right: 0, top, height: HOUR_ROW_MIN_HEIGHT }}
                className="flex-row"
              >
                <Text className="w-12 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  {hour.toString().padStart(2, '0')}:00
                </Text>
                <View className="mr-2 w-5" />
                <View className="mt-2 flex-1 border-t border-border/50" />
              </View>
            );
          })}

          {hours.map((hour, idx) => (
            <View
              key={`dot-${hour}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: HOUR_DOT_LEFT,
                top: idx * HOUR_ROW_MIN_HEIGHT + HOUR_DOT_MARGIN_TOP,
                width: HOUR_DOT_SIZE,
                height: HOUR_DOT_SIZE,
                zIndex: 2,
              }}
              className="rounded-full border border-border bg-background"
            />
          ))}

          {timedTodos.map((t) => {
            const { top, height } = todoBlockLayout(t, wakeHour, bedHour, HOUR_ROW_MIN_HEIGHT);
            const compact = height < COMPACT_TODO_BLOCK_HEIGHT;
            return (
              <View
                key={t.id}
                style={{
                  position: 'absolute',
                  left: TODO_AREA_LEFT,
                  right: 0,
                  top,
                  height,
                  zIndex: 5,
                }}
                className={`flex-row items-center gap-1.5 overflow-hidden rounded-lg bg-card/60 px-2 active:opacity-80 ${
                  compact ? 'py-0.5' : 'py-1.5'
                }`}
              >
                <Pressable
                  onPress={() =>
                    void toggleDone(t.id, t.done).catch(() => {
                      /* surfaced in customInstance */
                    })
                  }
                  className={`shrink-0 items-center justify-center rounded-full bg-muted/70 ${
                    compact ? 'h-6 w-6' : 'h-7 w-7'
                  }`}
                >
                  {t.done === 1 ? (
                    <Check size={compact ? 12 : 14} className="text-green-600" />
                  ) : null}
                </Pressable>
                <Pressable onPress={() => onOpenTodo(t)} className="min-w-0 flex-1 justify-center">
                  <Text
                    className={`text-foreground ${compact ? 'text-xs leading-tight' : 'text-sm'}`}
                    numberOfLines={compact ? 1 : 2}
                  >
                    {t.title}
                  </Text>
                  {!compact ? (
                    <View className="mt-0.5 flex-row items-center gap-1">
                      <Clock size={11} className="text-muted-foreground" />
                      <Text className="text-[11px] tabular-nums text-muted-foreground">
                        {todoScheduleClockLabel(t)}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}

          {viewingToday && scrollTarget == null && currentHour >= wakeHour && currentHour <= bedHour ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: HOUR_DOT_LEFT,
                right: 0,
                top: nowLineTop + HOUR_DOT_MARGIN_TOP + HOUR_DOT_SIZE / 2 - 1,
                flexDirection: 'row',
                alignItems: 'center',
                zIndex: 10,
              }}
            >
              <View className="h-2 w-2 rounded-full bg-destructive" />
              <View className="flex-1 h-[1px] bg-destructive" />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
