import { useState, useCallback, useMemo, useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSWRConfig } from 'swr';
import { useTodos } from '@/hooks/useTodos';
import { useTodosListView } from '@/hooks/useTodosListView';
import { useTodoUndoToast } from '@/hooks/useTodoUndoToast';
import { useTodosScreenPrefs } from '@/hooks/useTodosScreenPrefs';
import type { Todo } from '@/gen/api/schemas';
import { dayBoundsLocal, startOfLocalDay } from '@/lib/dayBounds';
import { listFilterSummary } from '@/lib/todoListFilters';
import {
  consumeTodosPostCreateIntent,
  DEFAULT_LIST_FILTERS,
} from '@/lib/todosScreenIntent';
import {
  getGetApiCalendarsKey,
  getGetApiEventsKey,
} from '@/gen/api/endpoints/techooAPI.gen';
import { FloatingCreateButton } from '@/components/navigation/FloatingCreateButton';
import { TodosScreenHeader } from '@/components/todos/TodosScreenHeader';
import { TodosTimelineView, type TimelineScrollTarget } from '@/components/todos/TodosTimelineView';
import { TodosListView } from '@/components/todos/TodosListView';
import { TodoUndoToast } from '@/components/todos/TodoUndoToast';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mutate: globalMutate } = useSWRConfig();
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<TimelineScrollTarget>(null);

  const { viewMode, setViewMode, listFilters, setListFilters, hydrated } = useTodosScreenPrefs();

  const bounds = useMemo(() => dayBoundsLocal(selectedDay), [selectedDay]);

  const {
    todos: timelineTodos,
    isLoading: timelineLoading,
    toggleDone: timelineToggleDone,
    createTodo: timelineCreateTodo,
    mutate: mutateTimeline,
  } = useTodos({
    from: bounds.start,
    to: bounds.endExclusive,
    includeCompletedInRange: false,
  });

  const {
    todos: listTodos,
    isLoading: listLoading,
    toggleDone: listToggleDone,
    mutate: mutateList,
  } = useTodosListView(selectedDay, listFilters);

  const { toast: undoToast, showCompleteUndo, dismissUndo } = useTodoUndoToast();

  useEffect(() => {
    if (viewMode !== 'list') dismissUndo();
  }, [viewMode, dismissUndo]);

  useFocusEffect(
    useCallback(() => {
      const intent = consumeTodosPostCreateIntent();
      if (!intent) return;

      if (intent.kind === 'list') {
        setViewMode('list');
        if (intent.filters) {
          setListFilters({ ...DEFAULT_LIST_FILTERS, ...intent.filters });
        }
        return;
      }

      setViewMode('timeline');
      setSelectedDay(startOfLocalDay(intent.day));
      if (intent.scrollToHour != null) {
        setScrollTarget({
          hour: intent.scrollToHour,
          minute: intent.scrollToMinute ?? 0,
        });
      } else {
        setScrollTarget(null);
      }
    }, [setViewMode, setListFilters])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (viewMode === 'timeline') {
        await Promise.all([
          mutateTimeline(),
          globalMutate(getGetApiCalendarsKey()),
          globalMutate(
            (key) => Array.isArray(key) && key[0] === getGetApiEventsKey()[0]
          ),
        ]);
      } else {
        await mutateList();
      }
    } finally {
      setRefreshing(false);
    }
  }, [viewMode, mutateTimeline, mutateList, globalMutate]);

  const handleListToggleDone = useCallback(
    async (id: number, done: number, options?: { reinsert?: Todo; undoTitle?: string }) => {
      const todo = listTodos.find((t) => t.id === id);
      try {
        if (done === 0 && todo) {
          const title = options?.undoTitle ?? todo.title;
          await listToggleDone(id, done);
          showCompleteUndo(title, () => listToggleDone(id, 1, { reinsert: todo }));
          return;
        }
        dismissUndo();
        await listToggleDone(id, done, done === 1 && todo ? { reinsert: todo } : undefined);
      } catch {
        /* surfaced in customInstance */
      }
    },
    [listTodos, listToggleDone, showCompleteUndo, dismissUndo]
  );

  const openTodo = useCallback(
    (t: Todo) => {
      router.push(`/todo/${t.id}`);
    },
    [router]
  );

  const toggleDone = viewMode === 'timeline' ? timelineToggleDone : handleListToggleDone;

  const headerSubtitle = useMemo(() => {
    if (viewMode === 'timeline') {
      return selectedDay.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    const countLabel =
      listTodos.length === 0
        ? 'No matches'
        : `${listTodos.length} item${listTodos.length === 1 ? '' : 's'}`;
    return `${countLabel} · ${listFilterSummary(listFilters)}`;
  }, [viewMode, selectedDay, listTodos.length, listFilters]);

  if (!hydrated) {
    return (
      <View className="flex-1 bg-background">
        <TodosScreenHeader
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          subtitle={headerSubtitle}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TodosScreenHeader
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        subtitle={headerSubtitle}
      />

      {viewMode === 'timeline' ? (
        <TodosTimelineView
          selectedDay={selectedDay}
          todos={timelineTodos}
          isLoading={timelineLoading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          toggleDone={timelineToggleDone}
          onOpenTodo={openTodo}
          onCreateTodo={timelineCreateTodo}
          bottomInset={insets.bottom}
          scrollTarget={scrollTarget}
          onScrollTargetHandled={() => setScrollTarget(null)}
        />
      ) : (
        <>
          <TodosListView
            selectedDay={selectedDay}
            filters={listFilters}
            onFiltersChange={setListFilters}
            todos={listTodos}
            isLoading={listLoading}
            refreshing={refreshing}
            onRefresh={onRefresh}
            toggleDone={handleListToggleDone}
            onOpenTodo={openTodo}
            bottomInset={insets.bottom}
          />
          {undoToast ? (
            <TodoUndoToast
              title={undoToast.title}
              onUndo={undoToast.onUndo}
              bottomInset={insets.bottom}
            />
          ) : null}
        </>
      )}

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
    </View>
  );
}
