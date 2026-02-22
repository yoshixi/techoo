import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Dimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSWRConfig } from 'swr';
import {
  useGetApiTasks,
  useGetApiTimers,
  putApiTasksId,
  getGetApiTasksKey,
} from '@/gen/api/endpoints/comoriAPI.gen';
import type { Task, CalendarEvent, Calendar } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { CalendarHeader } from './CalendarHeader';
import { DayColumn, type TimeRange } from './DayColumn';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { CreateTaskSheet } from '@/components/tasks/CreateTaskSheet';
import { addDays, startOfDay, isToday } from '@/lib/time';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOUR_HEIGHT = 60;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export type ViewMode = 'day' | 'week';

export function CalendarView() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createTimeRange, setCreateTimeRange] = useState<TimeRange | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Scroll to current time on mount
  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    // Scroll to 1 hour before current time so it's visible in context
    const scrollY = Math.max(0, (currentHour - 1) * HOUR_HEIGHT);
    // Small delay to ensure layout is ready
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const { data: tasksData, isLoading: tasksLoading } = useGetApiTasks();
  const { data: timersData } = useGetApiTimers();

  const tasks = tasksData?.tasks ?? [];
  const timers = timersData?.timers ?? [];

  // Get active timers for coloring
  const activeTimerTaskIds = useMemo(() => {
    return new Set(timers.filter((t) => !t.endTime).map((t) => t.taskId));
  }, [timers]);

  // Filter tasks for the selected date(s)
  const filteredTasks = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end =
      viewMode === 'day' ? addDays(start, 1) : addDays(start, 7);

    return tasks.filter((task) => {
      if (!task.startAt) return false;
      const taskStart = new Date(task.startAt);
      return taskStart >= start && taskStart < end;
    });
  }, [tasks, selectedDate, viewMode]);

  // Compute date range for calendar events
  const eventDateRange = useMemo(() => {
    const start = startOfDay(selectedDate);
    const end = viewMode === 'day' ? addDays(start, 1) : addDays(start, 7);
    return { startDate: start, endDate: end };
  }, [selectedDate, viewMode]);

  const { events: calendarEvents, calendars: syncedCalendars } = useCalendarEvents(eventDateRange);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach((event) => {
      const dayKey = startOfDay(new Date(event.startAt)).toISOString();
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(event);
    });
    return grouped;
  }, [calendarEvents]);

  // Build calendar color map
  const calendarColorMap = useMemo(() => {
    const map: Record<string, string | null> = {};
    syncedCalendars.forEach((cal) => {
      map[cal.id] = cal.color;
    });
    return map;
  }, [syncedCalendars]);

  // Group tasks by day (for week view)
  const tasksByDay = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    filteredTasks.forEach((task) => {
      if (!task.startAt) return;
      const dayKey = startOfDay(new Date(task.startAt)).toISOString();
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(task);
    });
    return grouped;
  }, [filteredTasks]);

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
    (task: Task) => {
      router.push(`/task/${task.id}`);
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
    async (task: Task, deltaMinutes: number) => {
      if (!task.startAt) return;

      const currentStart = new Date(task.startAt);
      const newStart = new Date(currentStart.getTime() + deltaMinutes * 60 * 1000);

      // Also update endAt if it exists
      let newEnd: Date | undefined;
      if (task.endAt) {
        const currentEnd = new Date(task.endAt);
        newEnd = new Date(currentEnd.getTime() + deltaMinutes * 60 * 1000);
      }

      try {
        await putApiTasksId(task.id, {
          startAt: newStart.toISOString(),
          endAt: newEnd?.toISOString(),
        });
        await mutate(getGetApiTasksKey());
      } catch (error) {
        console.error('Failed to move task:', error);
      }
    },
    [mutate]
  );

  if (tasksLoading) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="h-12 w-full mb-4" />
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
          {/* Time labels column */}
          <View className="w-12 pt-2">
            {HOURS.map((hour) => (
              <View key={hour} style={{ height: HOUR_HEIGHT }} className="justify-start">
                <Text className="text-xs text-muted-foreground text-right pr-2">
                  {hour.toString().padStart(2, '0')}:00
                </Text>
              </View>
            ))}
          </View>

          {/* Day columns */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-1"
          >
            {days.map((day) => {
              const dayKey = startOfDay(day).toISOString();
              const dayTasks = tasksByDay[dayKey] || [];
              const dayEvents = eventsByDay[dayKey] || [];
              const columnWidth =
                viewMode === 'day'
                  ? SCREEN_WIDTH - 60
                  : Math.max((SCREEN_WIDTH - 60) / 7, 80);

              return (
                <DayColumn
                  key={dayKey}
                  date={day}
                  tasks={dayTasks}
                  events={dayEvents}
                  calendarColorMap={calendarColorMap}
                  activeTimerTaskIds={activeTimerTaskIds}
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

        {/* Current time indicator for today */}
        {days.some((d) => isToday(d)) && (
          <CurrentTimeIndicator
            hourHeight={HOUR_HEIGHT}
            offsetLeft={48}
          />
        )}
      </ScrollView>

      <CreateTaskSheet
        visible={showCreateSheet}
        onClose={handleCloseCreateSheet}
        initialStartAt={createTimeRange?.startAt}
        initialEndAt={createTimeRange?.endAt}
      />
    </View>
  );
}
