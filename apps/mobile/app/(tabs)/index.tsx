import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useTodos } from '@/hooks/useTodos';
import type { Todo } from '@/gen/api/schemas';
import { dayBoundsLocal, isSameLocalDay, startOfLocalDay } from '@/lib/dayBounds';
import { formatTodoClockTime } from '@/lib/time';
import { WeeklyTabHeader } from '@/components/navigation/WeeklyTabHeader';
import { FloatingCreateButton } from '@/components/navigation/FloatingCreateButton';
import { useDailyHourWindow } from '@/hooks/useDailyHourWindow';

/** Clock row label — same rules as Electron `TodoView` (start – end, or “No time”). */
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

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()));
  const { wakeHour, bedHour } = useDailyHourWindow();
  const bounds = useMemo(() => dayBoundsLocal(selectedDay), [selectedDay]);
  const viewingToday = isSameLocalDay(selectedDay, new Date());

  const {
    todos,
    isLoading: todosLoading,
    toggleDone,
    mutate: mutateTodos,
  } = useTodos({
    from: bounds.start,
    to: bounds.endExclusive,
    includeCompletedInRange: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  /** API includes unscheduled (`starts_at` null) on every day; scope Plan + header to this calendar day. */
  const dayScopedTodos = useMemo(() => {
    const lo = bounds.start.getTime();
    const hi = bounds.endExclusive.getTime();
    return todos.filter((t) => {
      if (t.starts_at == null) return viewingToday;
      const s = new Date(t.starts_at).getTime();
      return s >= lo && s < hi;
    });
  }, [todos, bounds.start, bounds.endExclusive, viewingToday]);

  const sortedTodos = useMemo(() => sortTodosForPlan(dayScopedTodos), [dayScopedTodos]);
  const allDayTodos = useMemo(() => sortedTodos.filter((t) => t.is_all_day === 1), [sortedTodos]);
  const timedTodos = useMemo(
    () => sortedTodos.filter((t) => t.is_all_day !== 1 && t.starts_at != null),
    [sortedTodos]
  );
  const laterTodos = useMemo(
    () => sortedTodos.filter((t) => t.is_all_day !== 1 && t.starts_at == null),
    [sortedTodos]
  );
  const timedByHour = useMemo(() => {
    const map = new Map<number, Todo[]>();
    for (const t of timedTodos) {
      const hour = new Date(t.starts_at!).getHours();
      const current = map.get(hour) ?? [];
      current.push(t);
      map.set(hour, current);
    }
    return map;
  }, [timedTodos]);
  const hours = useMemo(
    () => Array.from({ length: bedHour - wakeHour + 1 }, (_, i) => wakeHour + i),
    [wakeHour, bedHour]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutateTodos();
    } finally {
      setRefreshing(false);
    }
  }, [mutateTodos]);

  const openTodo = useCallback(
    (t: Todo) => {
      router.push(`/todo/${t.id}`);
    },
    [router]
  );

  const statsLine =
    dayScopedTodos.length === 0
      ? 'Nothing on this page yet'
      : `${dayScopedTodos.length} open to-do${dayScopedTodos.length === 1 ? '' : 's'}`;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <WeeklyTabHeader title="ToDos" selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      <View className="px-4 pb-2">
        <Text className="text-xs text-muted-foreground">{statsLine}</Text>
      </View>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 84, 120) }}
      >
        {todosLoading ? <ActivityIndicator className="py-8" /> : null}
        {!todosLoading && sortedTodos.length === 0 ? (
          <Text className="py-6 text-sm text-muted-foreground">
            No to-dos for this day yet.
          </Text>
        ) : null}

        {!todosLoading && allDayTodos.length > 0 ? (
          <View className="mb-5">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              All day
            </Text>
            <View className="gap-2">
              {allDayTodos.map((t) => (
                <View
                  key={t.id}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <Pressable
                    onPress={() =>
                      void toggleDone(t.id, t.done).catch(() => {
                        /* failure surfaced in customInstance */
                      })
                    }
                    className="h-9 w-9 items-center justify-center rounded-full border border-border"
                  >
                    {t.done === 1 ? <Check size={18} className="text-green-600" /> : null}
                  </Pressable>
                  <Pressable onPress={() => openTodo(t)} className="min-w-0 flex-1">
                    <Text className="text-sm text-foreground">{t.title}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!todosLoading ? (
          <View className="mb-5">
            {hours.map((hour, idx) => {
              const entries = timedByHour.get(hour) ?? [];
              const isLast = idx === hours.length - 1;
              return (
                <View key={hour} className="min-h-11 flex-row">
                  <Text className="w-12 pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {hour.toString().padStart(2, '0')}:00
                  </Text>
                  <View className="mr-2 w-5 items-center">
                    <View className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/70" />
                    {!isLast ? <View className="h-9 w-px bg-border" /> : <View className="h-3" />}
                  </View>
                  <View className="flex-1 pb-2">
                    {entries.map((t) => (
                      <View
                        key={t.id}
                        className="mb-2 flex-row items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2"
                      >
                        <Pressable
                          onPress={() =>
                            void toggleDone(t.id, t.done).catch(() => {
                              /* failure surfaced in customInstance */
                            })
                          }
                          className="h-8 w-8 items-center justify-center rounded-full border border-border"
                        >
                          {t.done === 1 ? <Check size={16} className="text-green-600" /> : null}
                        </Pressable>
                        <Pressable onPress={() => openTodo(t)} className="min-w-0 flex-1">
                          <Text className="text-sm text-foreground">{t.title}</Text>
                          <View className="mt-1 flex-row items-center gap-1">
                            <Clock size={11} className="text-muted-foreground" />
                            <Text className="text-[11px] tabular-nums text-muted-foreground">
                              {todoScheduleClockLabel(t)}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!todosLoading && viewingToday && laterTodos.length > 0 ? (
          <View>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Later ({laterTodos.length})
            </Text>
            <View className="gap-2">
              {laterTodos.map((t) => (
                <View
                  key={t.id}
                  className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <Pressable
                    onPress={() =>
                      void toggleDone(t.id, t.done).catch(() => {
                        /* failure surfaced in customInstance */
                      })
                    }
                    className="h-9 w-9 items-center justify-center rounded-full border border-border"
                  >
                    {t.done === 1 ? <Check size={18} className="text-green-600" /> : null}
                  </Pressable>
                  <Pressable onPress={() => openTodo(t)} className="min-w-0 flex-1">
                    <Text className="text-sm text-foreground">{t.title}</Text>
                    <Text className="mt-1 text-[11px] text-muted-foreground">No start time</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <FloatingCreateButton
        bottomInset={insets.bottom}
        accessibilityLabel="Create to-do"
        onPress={() =>
          router.push({
            pathname: '/todo/new',
            params: { date: selectedDay.toISOString() },
          })
        }
      />
    </SafeAreaView>
  );
}
