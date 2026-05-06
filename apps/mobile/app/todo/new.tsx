import { useMemo, useState, useCallback } from 'react';
import { View, Pressable, TextInput, Modal, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { useTodos } from '@/hooks/useTodos';
import { startOfLocalDay } from '@/lib/dayBounds';
import { formatDateTime, formatTime } from '@/lib/time';

type ScheduleMode = 'later' | 'timed' | 'allDay';
type DurationPreset = '15' | '30' | '60' | 'custom';
type PickerTarget = 'date' | 'time';

function mergeDateAndTime(date: Date, time: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0
  );
}

export default function NewTodoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const anchorDate = useMemo(() => {
    const parsed = params.date ? new Date(params.date) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [params.date]);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<ScheduleMode>('later');
  const [date, setDate] = useState(() => startOfLocalDay(anchorDate));
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    return now;
  });
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('30');
  const [customDurationMin, setCustomDurationMin] = useState('45');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { createTodo } = useTodos();

  const durationMin = useMemo(() => {
    if (durationPreset !== 'custom') return Number(durationPreset);
    const parsed = Number(customDurationMin);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  }, [durationPreset, customDurationMin]);

  const startAt = useMemo(() => mergeDateAndTime(date, startTime), [date, startTime]);
  const endAt = useMemo(
    () => new Date(startAt.getTime() + Math.max(durationMin, 0) * 60_000),
    [startAt, durationMin]
  );

  const saveDisabled =
    !title.trim() || submitting || (mode === 'timed' && (!Number.isFinite(durationMin) || durationMin <= 0));

  const onSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      if (mode === 'later') {
        await createTodo(trimmed);
      } else if (mode === 'allDay') {
        await createTodo(trimmed, startOfLocalDay(date), undefined, 1);
      } else {
        await createTodo(trimmed, startAt, endAt, 0);
      }
      void notes; // reserved for future API support
      router.back();
    } finally {
      setSubmitting(false);
    }
  }, [title, mode, createTodo, date, startAt, endAt, router, notes]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
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
          className="mb-4 rounded-xl border border-border bg-card px-3 py-3 text-base text-foreground"
        />

        <Text className="mb-2 text-xs text-muted-foreground">Schedule</Text>
        <View className="mb-4 flex-row gap-2">
          {([
            ['later', 'Later'],
            ['timed', 'Timed'],
            ['allDay', 'All day'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setMode(value)}
              className={`rounded-full border px-3 py-2 ${
                mode === value ? 'border-primary bg-primary/15' : 'border-border bg-card'
              }`}
            >
              <Text className={`text-xs font-semibold ${mode === value ? 'text-primary' : 'text-foreground'}`}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'later' ? (
          <Text className="mb-4 text-sm text-muted-foreground">
            No start time. This item appears in the Later section.
          </Text>
        ) : null}

        {mode === 'allDay' ? (
          <View className="mb-4">
            <Text className="mb-1 text-xs text-muted-foreground">Date</Text>
            <Pressable
              onPress={() => setPickerTarget('date')}
              className="mb-2 rounded-xl border border-border bg-card px-3 py-3"
            >
              <Text className="text-sm text-foreground">{date.toLocaleDateString()}</Text>
            </Pressable>
            <Text className="text-sm text-muted-foreground">
              Runs all day on the selected date.
            </Text>
          </View>
        ) : null}

        {mode === 'timed' ? (
          <View className="mb-4">
            <Text className="mb-1 text-xs text-muted-foreground">Start time</Text>
            <Pressable
              onPress={() => setPickerTarget('time')}
              className="mb-3 rounded-xl border border-border bg-card px-3 py-3"
            >
              <Text className="text-sm text-foreground">{formatTime(startAt)}</Text>
            </Pressable>

            <Text className="mb-2 text-xs text-muted-foreground">Duration</Text>
            <View className="mb-2 flex-row gap-2">
              {([
                ['15', '15m'],
                ['30', '30m'],
                ['60', '1h'],
                ['custom', 'Custom'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setDurationPreset(value)}
                  className={`rounded-full border px-3 py-2 ${
                    durationPreset === value ? 'border-primary bg-primary/15' : 'border-border bg-card'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      durationPreset === value ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {durationPreset === 'custom' ? (
              <TextInput
                value={customDurationMin}
                onChangeText={setCustomDurationMin}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                placeholder="Minutes"
                placeholderTextColor="#9ca3af"
                className="mb-2 rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground"
              />
            ) : null}
            <Text className="text-sm text-muted-foreground">
              Ends at: {durationMin > 0 ? formatDateTime(endAt) : 'Enter valid duration'}
            </Text>
          </View>
        ) : null}

        <Text className="mb-1 text-xs text-muted-foreground">Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder=""
          placeholderTextColor="#9ca3af"
          multiline
          className="min-h-[90px] rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground"
          textAlignVertical="top"
        />
      </View>

      <Modal visible={pickerTarget !== null} transparent animationType="fade" onRequestClose={() => setPickerTarget(null)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setPickerTarget(null)}>
          <Pressable
            className="rounded-t-3xl bg-card pb-4"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            onPress={(event) => event.stopPropagation()}
          >
            {pickerTarget ? (
              <DateTimePicker
                value={pickerTarget === 'date' ? date : startAt}
                mode={pickerTarget}
                display="spinner"
                themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android' && event.type === 'dismissed') {
                    setPickerTarget(null);
                    return;
                  }
                  if (!selected) return;
                  if (pickerTarget === 'date') {
                    setDate(startOfLocalDay(selected));
                  } else {
                    setStartTime(selected);
                  }
                  if (Platform.OS === 'android') setPickerTarget(null);
                }}
              />
            ) : null}
            <Pressable onPress={() => setPickerTarget(null)} className="items-center pt-2">
              <Text className="text-base font-semibold text-primary">Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
