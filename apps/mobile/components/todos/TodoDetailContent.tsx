import { useCallback, useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Trash2, CheckCircle, Check, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useTodos } from '@/hooks/useTodos';
import { useAutoSave } from '@/hooks/useAutoSave';
import { formatDateTime } from '@/lib/time';
import type { Todo } from '@/gen/api/schemas';

export interface TodoDetailContentProps {
  todoId: number;
}

export function TodoDetailContent({ todoId }: TodoDetailContentProps) {
  const router = useRouter();
  const { todos, isLoading, error, updateTodo, toggleDone, deleteTodo } = useTodos({ fetchAll: true });
  const todo = todos.find((t) => t.id === todoId) ?? null;

  /** Survives brief SWR gaps during global revalidation so the screen doesn’t flash to skeleton. */
  const lastGoodTodoRef = useRef<{ id: number; todo: Todo } | null>(null);
  const prevTodoIdRef = useRef(todoId);

  useEffect(() => {
    if (prevTodoIdRef.current !== todoId) {
      lastGoodTodoRef.current = null;
      prevTodoIdRef.current = todoId;
    }
    if (todo) {
      lastGoodTodoRef.current = { id: todoId, todo };
    }
  }, [todo, todoId]);

  useEffect(() => {
    if (isLoading || todo != null) return;
    if (todos.length > 0 && !todos.some((t) => t.id === todoId)) {
      lastGoodTodoRef.current = null;
    }
  }, [isLoading, todo, todos, todoId]);

  const resolvedTodo =
    todo ?? (lastGoodTodoRef.current?.id === todoId ? lastGoodTodoRef.current.todo : null);

  const [title, setTitle] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimer = useCallback(() => {
    if (savedClearTimerRef.current) {
      clearTimeout(savedClearTimerRef.current);
      savedClearTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSavedTimer(), [clearSavedTimer]);

  // Sync from server only when fields actually change — not when SWR replaces the `todo` object
  // after revalidate (that caused a full form “flash”). Skip while schedule PATCH is in flight.
  useEffect(() => {
    if (!resolvedTodo || scheduleFeedback === 'saving') return;
    setTitle(resolvedTodo.title);
    setAllDay(resolvedTodo.is_all_day === 1);
    if (resolvedTodo.starts_at != null) {
      const nextMs = new Date(resolvedTodo.starts_at).getTime();
      setStartDate((prev) => {
        if (prev != null && prev.getTime() === nextMs) return prev;
        return new Date(nextMs);
      });
    } else {
      setStartDate(null);
    }
  }, [todoId, resolvedTodo?.title, resolvedTodo?.starts_at, resolvedTodo?.is_all_day, scheduleFeedback]);

  const handleSaveTitle = useCallback(
    async (value: string) => {
      if (!resolvedTodo || !value.trim()) return;
      await updateTodo(resolvedTodo.id, { title: value.trim() });
    },
    [resolvedTodo, updateTodo]
  );

  const { isPending, isSaving } = useAutoSave({
    value: title,
    onSave: handleSaveTitle,
    delay: 800,
    enabled:
      !!resolvedTodo && title.trim().length > 0 && title !== resolvedTodo.title,
  });

  const titleSaving = isPending || isSaving;

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete to-do', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTodo(todoId);
            router.back();
          } catch {
            /* failure reported in customInstance */
          }
        },
      },
    ]);
  }, [deleteTodo, todoId, router]);

  const handleToggleDone = useCallback(async () => {
    if (!resolvedTodo) return;
    await toggleDone(resolvedTodo.id, resolvedTodo.done);
  }, [resolvedTodo, toggleDone]);

  const applySchedule = useCallback(
    async (next: Date | null, nextAllDay: boolean) => {
      if (!resolvedTodo) return;
      clearSavedTimer();
      setScheduleFeedback('saving');
      try {
        if (nextAllDay && next) {
          const d = new Date(next);
          d.setHours(0, 0, 0, 0);
          await updateTodo(resolvedTodo.id, {
            is_all_day: 1,
            starts_at: d,
            ends_at: null,
          });
        } else if (next) {
          await updateTodo(resolvedTodo.id, {
            is_all_day: 0,
            starts_at: next,
            ends_at: resolvedTodo.ends_at != null ? new Date(resolvedTodo.ends_at) : null,
          });
        } else {
          await updateTodo(resolvedTodo.id, {
            is_all_day: 0,
            starts_at: null,
            ends_at: null,
          });
        }
        setScheduleFeedback('saved');
        savedClearTimerRef.current = setTimeout(() => {
          setScheduleFeedback('idle');
          savedClearTimerRef.current = null;
        }, 1600);
      } catch {
        setScheduleFeedback('idle');
      }
    },
    [resolvedTodo, updateTodo, clearSavedTimer]
  );

  const onAllDayChange = useCallback(
    async (v: boolean) => {
      setAllDay(v);
      await applySchedule(startDate ?? new Date(), v);
    },
    [applySchedule, startDate]
  );

  const onDatePicked = useCallback(
    async (_e: unknown, selected?: Date) => {
      setShowPicker(false);
      if (selected) {
        setStartDate(selected);
        await applySchedule(selected, allDay);
      }
    },
    [applySchedule, allDay]
  );

  if (isLoading && resolvedTodo == null) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton className="mb-2 h-4 w-full" />
      </View>
    );
  }

  if (resolvedTodo == null) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-destructive">
          {error ? 'Could not load to-do' : 'To-do not found'}
        </Text>
        <Button onPress={handleClose} className="mt-4">
          <Text>Go back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={handleClose} hitSlop={10}>
          <X size={24} className="text-muted-foreground" />
        </Pressable>
        <View className="min-w-[88px] flex-row items-center justify-end gap-3">
          {titleSaving || scheduleFeedback === 'saving' ? (
            <Text className="text-xs text-muted-foreground">Saving…</Text>
          ) : scheduleFeedback === 'saved' ? (
            <Check size={20} className="text-green-600" />
          ) : null}
          <Pressable onPress={() => void handleToggleDone()} hitSlop={10}>
            <CheckCircle
              size={22}
              className={resolvedTodo.done === 1 ? 'text-green-600' : 'text-muted-foreground'}
            />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Trash2 size={20} className="text-destructive" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-xs text-muted-foreground">Title</Text>
        <Input value={title} onChangeText={setTitle} className="mb-4" />

        <View className="mb-4 flex-row items-center justify-between rounded-lg border border-border px-3 py-2">
          <Text className="text-sm">All day</Text>
          <Switch checked={allDay} onCheckedChange={(v) => void onAllDayChange(v)} />
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-xs text-muted-foreground">When</Text>
          <Pressable
            onPress={() => setShowPicker(true)}
            className="flex-row items-center gap-2 rounded-lg bg-muted px-3 py-2"
          >
            <Calendar size={16} className="text-muted-foreground" />
            <Text className="text-sm">
              {startDate ? formatDateTime(startDate.toISOString()) : 'Unscheduled'}
            </Text>
          </Pressable>
          {startDate ? (
            <Button variant="ghost" className="mt-2" onPress={() => void applySchedule(null, false)}>
              <Text className="text-xs text-muted-foreground">Clear schedule</Text>
            </Button>
          ) : null}
        </View>

        {showPicker ? (
          <DateTimePicker
            value={startDate || new Date()}
            mode={allDay ? 'date' : 'datetime'}
            display="spinner"
            onChange={onDatePicked}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
