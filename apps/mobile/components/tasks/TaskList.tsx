import { useCallback, useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import { useGetApiTasks, useGetApiTimers, getApiTasksTaskIdTimers, putApiTasksId } from '@/gen/api/endpoints/comoriAPI.gen';
import type { Task, TaskTimer } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskListItem } from './TaskListItem';
import { TaskFilterButton, type FilterState, type SortState } from './TaskFilters';
import { FilterSheet } from './FilterSheet';
import { InProgressSection } from './InProgressSection';
import { CreateTaskSheet } from './CreateTaskSheet';
import { QuickStartTask } from './QuickStartTask';
import { TodayTasks } from './TodayTasks';
import { CarryoverSection } from './CarryoverSection';
import { TimerFillSheet } from './TimerFillSheet';
import { startOfDay, addDays } from '@/lib/time';

export function TaskList() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [timerFillTask, setTimerFillTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    showCompleted: false,
    selectedTagIds: [],
  });
  const [sort, setSort] = useState<SortState>({
    sortBy: 'startAt',
    order: 'asc',
  });

  const { data: tasksData, isLoading, error, isValidating } = useGetApiTasks({
    completed: filters.showCompleted ? undefined : 'false',
    tags: filters.selectedTagIds.length > 0 ? filters.selectedTagIds : undefined,
    sortBy: sort.sortBy,
    order: sort.order,
  });

  const { data: timersData } = useGetApiTimers();

  const tasks = tasksData?.tasks ?? [];
  const timers = timersData?.timers ?? [];

  // Find active timers (no endTime)
  const activeTimers = useMemo(() => {
    return timers.filter((timer) => !timer.endTime);
  }, [timers]);

  // Map of taskId to active timer
  const activeTimerByTaskId = useMemo(() => {
    const map: Record<number, TaskTimer> = {};
    activeTimers.forEach((timer) => {
      map[timer.taskId] = timer;
    });
    return map;
  }, [activeTimers]);

  // Tasks with active timers
  const inProgressTasks = useMemo(() => {
    return tasks.filter((task) => activeTimerByTaskId[task.id]);
  }, [tasks, activeTimerByTaskId]);

  // Today's tasks (scheduled for today, excluding in-progress)
  const todayTasks = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = addDays(todayStart, 1);

    return tasks.filter((task) => {
      if (activeTimerByTaskId[task.id]) return false; // Exclude in-progress
      if (!task.startAt) return false;
      const taskStart = new Date(task.startAt);
      return taskStart >= todayStart && taskStart < todayEnd;
    });
  }, [tasks, activeTimerByTaskId]);

  // Carryover tasks (incomplete, scheduled before today)
  const carryoverTasks = useMemo(() => {
    const todayStart = startOfDay(new Date());

    return tasks.filter((task) => {
      if (activeTimerByTaskId[task.id]) return false;
      if (task.completedAt) return false;
      if (!task.startAt) return false;
      const taskStart = new Date(task.startAt);
      return taskStart < todayStart;
    });
  }, [tasks, activeTimerByTaskId]);

  // Other tasks (not in-progress, not today, not carryover)
  const otherTasks = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = addDays(todayStart, 1);
    const carryoverIds = new Set(carryoverTasks.map((t) => t.id));

    return tasks.filter((task) => {
      if (activeTimerByTaskId[task.id]) return false; // Exclude in-progress
      if (carryoverIds.has(task.id)) return false; // Exclude carryover
      if (!task.startAt) return true; // Include unscheduled
      const taskStart = new Date(task.startAt);
      return taskStart < todayStart || taskStart >= todayEnd; // Exclude today
    });
  }, [tasks, activeTimerByTaskId, carryoverTasks]);

  // Check if task has timer records before completing
  const handleCompleteWithTimerCheck = useCallback(
    async (task: Task) => {
      try {
        const timersResponse = await getApiTasksTaskIdTimers(task.id);
        const taskTimers = timersResponse?.timers ?? [];

        if (taskTimers.length === 0) {
          // No timer records — show the fill-out sheet
          setTimerFillTask(task);
        } else {
          // Has timer records — complete directly
          await putApiTasksId(task.id, {
            completedAt: new Date().toISOString(),
          });
          await mutate(
            (key) => Array.isArray(key) && key[0] === '/api/tasks',
            undefined,
            { revalidate: true }
          );
        }
      } catch (error) {
        console.error('Failed to check timers:', error);
      }
    },
    [mutate]
  );

  const handleRefresh = useCallback(async () => {
    // Mutate all task queries by using a filter function
    await mutate(
      (key) => Array.isArray(key) && key[0] === '/api/tasks',
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  const handleTaskPress = useCallback(
    (task: Task) => {
      router.push(`/task/${task.id}`);
    },
    [router]
  );

  const handleCreatePress = useCallback(() => {
    setShowCreateSheet(true);
  }, []);

  const handleCreateClose = useCallback(() => {
    setShowCreateSheet(false);
  }, []);

  const renderTask = useCallback(
    ({ item }: { item: Task }) => (
      <TaskListItem
        task={item}
        activeTimer={activeTimerByTaskId[item.id]}
        onPress={() => handleTaskPress(item)}
        onComplete={handleCompleteWithTimerCheck}
      />
    ),
    [activeTimerByTaskId, handleTaskPress, handleCompleteWithTimerCheck]
  );

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-destructive mb-2">Failed to load tasks</Text>
        <Button onPress={handleRefresh}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {isLoading ? (
        <View className="p-4 gap-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </View>
      ) : (
        <FlatList
          data={otherTasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTask}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isValidating} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-lg font-semibold">Tasks</Text>
                <TaskFilterButton
                  filters={filters}
                  sort={sort}
                  onPress={() => setShowFilterSheet(true)}
                />
              </View>
              <QuickStartTask activeTimers={activeTimers} />
              {inProgressTasks.length > 0 && (
                <InProgressSection
                  tasks={inProgressTasks}
                  activeTimerByTaskId={activeTimerByTaskId}
                  onTaskPress={handleTaskPress}
                />
              )}
              <CarryoverSection
                tasks={carryoverTasks}
                onComplete={handleCompleteWithTimerCheck}
              />
              <TodayTasks
                tasks={todayTasks}
                activeTimerByTaskId={activeTimerByTaskId}
                onTaskPress={handleTaskPress}
              />
              {otherTasks.length > 0 && (
                <Text className="text-sm font-medium text-muted-foreground mb-2 mt-2">
                  Other Tasks
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-8">
              <Text className="text-muted-foreground">Your slate is clean!</Text>
              <Text className="text-muted-foreground text-sm mt-1">
                Tap + to add something you'd like to focus on
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        onPress={handleCreatePress}
        className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-primary items-center justify-center active:opacity-80"
      >
        <Plus size={24} color="white" />
      </Pressable>

      <CreateTaskSheet visible={showCreateSheet} onClose={handleCreateClose} />
      <FilterSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={filters}
        sort={sort}
        onFiltersChange={setFilters}
        onSortChange={setSort}
      />
      <TimerFillSheet
        visible={!!timerFillTask}
        task={timerFillTask}
        onClose={() => setTimerFillTask(null)}
      />
    </View>
  );
}
