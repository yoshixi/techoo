import { useMemo, useState, useCallback } from 'react';
import { View, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useTodos } from '@/hooks/useTodos';
import { startOfLocalDay } from '@/lib/dayBounds';
import {
  buildScheduleUpdate,
  durationMinutes,
  type DurationPreset,
  type TodoScheduleMode,
} from '@/lib/todoSchedule';
import { postCreateIntentForTodo, setTodosPostCreateIntent } from '@/lib/todosScreenIntent';
import { TodoScheduleFields } from '@/components/todos/TodoScheduleFields';

export default function NewTodoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const anchorDate = useMemo(() => {
    const parsed = params.date ? new Date(params.date) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [params.date]);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<TodoScheduleMode>('later');
  const [date, setDate] = useState(() => startOfLocalDay(anchorDate));
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now;
  });
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('30');
  const [customDurationMin, setCustomDurationMin] = useState('45');
  const [submitting, setSubmitting] = useState(false);
  const { createTodo } = useTodos();

  const durationMin = useMemo(
    () => durationMinutes(durationPreset, customDurationMin),
    [durationPreset, customDurationMin]
  );

  const saveDisabled =
    !title.trim() || submitting || (mode === 'timed' && durationMin <= 0);

  const onSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const schedule = buildScheduleUpdate(mode, date, startTime, durationMin);
      if (mode === 'later') {
        await createTodo(trimmed);
        setTodosPostCreateIntent(postCreateIntentForTodo({ mode: 'later' }));
      } else if (mode === 'allDay') {
        await createTodo(trimmed, schedule.starts_at ?? undefined, undefined, 1);
        setTodosPostCreateIntent(
          postCreateIntentForTodo({ mode: 'allDay', startsAt: schedule.starts_at ?? undefined })
        );
      } else {
        await createTodo(trimmed, schedule.starts_at ?? undefined, schedule.ends_at ?? undefined, 0);
        setTodosPostCreateIntent(
          postCreateIntentForTodo({ mode: 'timed', startsAt: schedule.starts_at ?? undefined })
        );
      }
      void notes;
      router.back();
    } catch {
      // API error is surfaced in customInstance.
    } finally {
      setSubmitting(false);
    }
  }, [title, mode, createTodo, date, startTime, durationMin, router, notes]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between border-b border-border/35 px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-muted-foreground">Cancel</Text>
        </Pressable>
        <Text className="text-base font-semibold text-foreground">New ToDo</Text>
        <Pressable onPress={() => void onSave()} disabled={saveDisabled}>
          <Text className={`text-base font-semibold ${saveDisabled ? 'text-muted-foreground' : 'text-primary'}`}>
            {submitting ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 px-4 pt-4">
        <Text className="mb-1 text-xs text-muted-foreground">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Write title here"
          placeholderTextColor="#9ca3af"
          className="mb-4 rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-base text-foreground"
        />

        <TodoScheduleFields
          mode={mode}
          onModeChange={setMode}
          date={date}
          onDateChange={setDate}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          durationPreset={durationPreset}
          onDurationPresetChange={setDurationPreset}
          customDurationMin={customDurationMin}
          onCustomDurationMinChange={setCustomDurationMin}
        />

        {mode === 'timed' ? (
          <Text className="-mt-4 mb-4 text-sm text-muted-foreground">
            Opens Schedule on this date after saving.
          </Text>
        ) : null}

        <Text className="mb-1 text-xs text-muted-foreground">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder=""
          placeholderTextColor="#9ca3af"
          multiline
          className="min-h-[90px] rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
          textAlignVertical="top"
        />
      </View>

      {submitting ? <ActivityIndicator className="py-2" /> : null}
    </SafeAreaView>
  );
}
