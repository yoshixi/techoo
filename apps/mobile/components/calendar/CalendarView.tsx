import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import type { CalendarEvent } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useTodos } from '@/hooks/useTodos';
import { todoToCalendarTimedItem, type CalendarTimedItem } from '@/lib/todoCalendar';
import { CalendarHeader } from './CalendarHeader';
import { DayColumn, type TimeRange } from './DayColumn';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { CreateTodoSheet } from '@/components/todos/CreateTodoSheet';
import { addDays, startOfDay, isToday } from '@/lib/time';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export type ViewMode = 'day' | 'week';

export function CalendarView() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createTimeRange, setCreateTimeRange] = useState<TimeRange | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const scrollY = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const listRange = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end = viewMode === 'day' ? addDays(start, 1) : addDays(start, 7);
    return { from: start, to: end };
  }, [selectedDate, viewMode]);

  const { todos, isLoading: todosLoading, createTodo, updateTodo } = useTodos({
    from: listRange.from,
    to: listRange.to,
    includeCompletedInRange: true,
  });

  const calendarItems = useMemo(
    () =>
      todos
        .map(todoToCalendarTimedItem)
        .filter((x): x is NonNullable<typeof x> => x != null),
    [todos]
  );

  const eventDateRange = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end = viewMode === 'day' ? addDays(start, 1) : addDays(start, 7);
    return { startDate: start, endDate: end };
  }, [selectedDate, viewMode]);

  const { events: calendarEvents, calendars: syncedCalendars } = useCalendarEvents(eventDateRange);

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach((event) => {
      const dayKey = startOfDay(new Date(event.startAt)).toISOString();
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(event);
    });
    return grouped;
  }, [calendarEvents]);

  const calendarColorMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    syncedCalendars.forEach((cal) => {
      map[cal.id] = cal.color;
    });
    return map;
  }, [syncedCalendars]);

  const tasksByDay = useMemo(() => {
    const grouped: Record<string, typeof calendarItems> = {};
    calendarItems.forEach((item) => {
      if (!item.startAt) return;
      const dayKey = startOfDay(new Date(item.startAt)).toISOString();
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(item);
    });
    return grouped;
  }, [calendarItems]);

  const handlePrevious = useCallback(() => {
    setSelectedDate((d) => addDays(d, viewMode === 'day' ? -1 : -7));
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setSelectedDate((d) => addDays(d, viewMode === 'day' ? 1 : 7));
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const handleTaskPress = useCallback(
    (task: CalendarTimedItem) => {
      router.push(`/todo/${task.id}`);
    },
    [router]
  );

  const handleToggleViewMode = useCallback(() => {
    setViewMode((m) => (m === 'day' ? 'week' : 'day'));
  }, []);

  const handleCreateRange = useCallback((range: TimeRange) => {
    setCreateTimeRange(range);
    setShowCreateSheet(true);
  }, []);

  const handleCloseCreateSheet = useCallback(() => {
    setShowCreateSheet(false);
    setCreateTimeRange(null);
  }, []);

  const handleTaskMove = useCallback(
    async (task: CalendarTimedItem, deltaMinutes: number) => {
      const currentStart = new Date(task.startAt);
      const newStart = new Date(currentStart.getTime() + deltaMinutes * 60 * 1000);
      try {
        await updateTodo(task.id, {
          starts_at: newStart,
          ends_at: task.endAt
            ? new Date(new Date(task.endAt).getTime() + deltaMinutes * 60 * 1000)
            : null,
        });
      } catch {
        /* failure reported in customInstance */
      }
    },
    [updateTodo]
  );

  if (todosLoading) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="mb-4 h-12 w-full" />
        <Skeleton className="h-full w-full" />
      </View>
    );
  }

  const days =
    viewMode === 'day'
      ? [selectedDate]
      : Array.from({ length: 7 }, (_, i) => addDays(startOfDay(selectedDate), i));

  return (
    <View className="flex-1">
      <CalendarHeader
        selectedDate={selectedDate}
        viewMode={viewMode}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onToggleViewMode={handleToggleViewMode}
      />

      <ScrollView ref={scrollViewRef} className="flex-1">
        <View className="flex-row">
          <View className="w-12 pt-2">
            {HOURS.map((hour) => (
              <View key={hour} style={{ height: HOUR_HEIGHT }} className="justify-start">
                <Text className="pr-2 text-right text-xs text-muted-foreground">
                  {hour.toString().padStart(2, '0')}:00
                </Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
            {days.map((day) => {
              const dayKey = startOfDay(day).toISOString();
              const dayTasks = tasksByDay[dayKey] || [];
              const dayEvents = eventsByDay[dayKey] || [];
              const columnWidth =
                viewMode === 'day' ? SCREEN_WIDTH - 60 : Math.max((SCREEN_WIDTH - 60) / 7, 80);

              return (
                <DayColumn
                  key={dayKey}
                  date={day}
                  tasks={dayTasks}
                  events={dayEvents}
                  calendarColorMap={calendarColorMap}
                  hourHeight={HOUR_HEIGHT}
                  columnWidth={columnWidth}
                  onTaskPress={handleTaskPress}
                  onCreateRange={handleCreateRange}
                  onTaskMove={handleTaskMove}
                  showDayLabel={viewMode === 'week'}
                />
              );
            })}
          </ScrollView>
        </View>

        {days.some((d) => isToday(d)) ? (
          <CurrentTimeIndicator hourHeight={HOUR_HEIGHT} offsetLeft={48} />
        ) : null}
      </ScrollView>

      <CreateTodoSheet
        visible={showCreateSheet}
        onClose={handleCloseCreateSheet}
        initialStartAt={createTimeRange?.startAt}
        initialEndAt={createTimeRange?.endAt}
        onCreate={createTodo}
      />
    </View>
  );
}
