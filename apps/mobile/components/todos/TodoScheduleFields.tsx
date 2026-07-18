import { useMemo, useState } from 'react';
import { View, Pressable, TextInput, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { formatDateTime, formatTime } from '@/lib/time';
import { startOfLocalDay } from '@/lib/dayBounds';
import {
  durationMinutes,
  mergeDateAndTime,
  type DurationPreset,
  type TodoScheduleMode,
} from '@/lib/todoSchedule';

type PickerTarget = 'date' | 'time';

export function TodoScheduleFields({
  mode,
  onModeChange,
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  durationPreset,
  onDurationPresetChange,
  customDurationMin,
  onCustomDurationMinChange,
  onCustomDurationCommit,
}: {
  mode: TodoScheduleMode;
  onModeChange: (mode: TodoScheduleMode) => void;
  date: Date;
  onDateChange: (date: Date) => void;
  startTime: Date;
  onStartTimeChange: (time: Date) => void;
  durationPreset: DurationPreset;
  onDurationPresetChange: (preset: DurationPreset) => void;
  customDurationMin: string;
  onCustomDurationMinChange: (value: string) => void;
  onCustomDurationCommit?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const startAt = useMemo(() => mergeDateAndTime(date, startTime), [date, startTime]);
  const durationMin = useMemo(
    () => durationMinutes(durationPreset, customDurationMin),
    [durationPreset, customDurationMin]
  );
  const endAt = useMemo(
    () => new Date(startAt.getTime() + Math.max(durationMin, 0) * 60_000),
    [startAt, durationMin]
  );

  return (
    <View className="mb-6">
      <Text className="mb-2 text-xs text-muted-foreground">Schedule</Text>
      <View className="mb-4 flex-row gap-2">
        {(
          [
            ['later', 'Later'],
            ['timed', 'Timed'],
            ['allDay', 'All day'],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => onModeChange(value)}
            className={`rounded-full border px-3 py-2 ${
              mode === value ? 'border-primary/35 bg-primary/15' : 'border-border/35 bg-card/70'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${mode === value ? 'text-primary' : 'text-foreground'}`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'later' ? (
        <Text className="text-sm text-muted-foreground">No start time — shows in List under Later.</Text>
      ) : null}

      {mode === 'allDay' ? (
        <View>
          <Text className="mb-1 text-xs text-muted-foreground">Date</Text>
          <Pressable
            onPress={() => setPickerTarget('date')}
            className="rounded-xl border border-border/40 bg-card/70 px-3 py-3"
          >
            <Text className="text-sm text-foreground">{date.toLocaleDateString()}</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'timed' ? (
        <View>
          <Text className="mb-1 text-xs text-muted-foreground">Date</Text>
          <Pressable
            onPress={() => setPickerTarget('date')}
            className="mb-3 rounded-xl border border-border/40 bg-card/70 px-3 py-3"
          >
            <Text className="text-sm text-foreground">{date.toLocaleDateString()}</Text>
          </Pressable>

          <Text className="mb-1 text-xs text-muted-foreground">Start time</Text>
          <Pressable
            onPress={() => setPickerTarget('time')}
            className="mb-3 rounded-xl border border-border/40 bg-card/70 px-3 py-3"
          >
            <Text className="text-sm text-foreground">{formatTime(startAt)}</Text>
          </Pressable>

          <Text className="mb-2 text-xs text-muted-foreground">Duration</Text>
          <View className="mb-2 flex-row flex-wrap gap-2">
            {(
              [
                ['15', '15m'],
                ['30', '30m'],
                ['60', '1h'],
                ['custom', 'Custom'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => onDurationPresetChange(value)}
                className={`rounded-full border px-3 py-2 ${
                  durationPreset === value
                    ? 'border-primary/35 bg-primary/15'
                    : 'border-border/35 bg-card/70'
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
              onChangeText={onCustomDurationMinChange}
              onBlur={onCustomDurationCommit}
              keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
              placeholder="Minutes"
              placeholderTextColor="#9ca3af"
              className="mb-2 rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
            />
          ) : null}

          <Text className="text-sm text-muted-foreground">
            Ends at: {durationMin > 0 ? formatDateTime(endAt.toISOString()) : 'Enter valid duration'}
          </Text>
        </View>
      ) : null}

      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
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
                    onDateChange(startOfLocalDay(selected));
                  } else {
                    onStartTimeChange(selected);
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
    </View>
  );
}
