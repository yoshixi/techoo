import { useState, useCallback } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Play } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import type { TaskTimer } from '@/gen/api/schemas';
import {
  postApiTasks,
  postApiTimers,
  putApiTimersId,
} from '@/gen/api/endpoints/techoAPI.gen';
import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';

const DURATION_OPTIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
] as const;

export interface QuickStartTaskProps {
  activeTimers?: TaskTimer[];
}

export function QuickStartTask({ activeTimers = [] }: QuickStartTaskProps) {
  const { mutate } = useSWRConfig();
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isCreating, setIsCreating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleQuickStart = useCallback(async () => {
    if (!title.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const now = new Date();
      const endAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

      // Stop all running timers before starting a new focus session.
      // This prevents multiple timers from running simultaneously — the user
      // can only focus on one task at a time. We re-filter for !endTime here
      // because the parent's activeTimers list may include stale entries
      // between SWR revalidations.
      if (activeTimers.length > 0) {
        await Promise.all(
          activeTimers
            .filter((t) => !t.endTime)
            .map((timer) =>
              putApiTimersId(timer.id, { endTime: now.toISOString() })
            )
        );
      }

      // Create task with startAt = now and endAt = now + duration
      const taskResponse = await postApiTasks({
        title: title.trim(),
        startAt: now.toISOString(),
        endAt: endAt.toISOString(),
      });

      // Start timer immediately
      await postApiTimers({
        taskId: taskResponse.task.id,
        startTime: now.toISOString(),
      });

      // Refresh both tasks and timers
      await Promise.all([
        mutate(
          (key) => Array.isArray(key) && key[0] === '/api/tasks',
          undefined,
          { revalidate: true }
        ),
        mutate(
          (key) => Array.isArray(key) && key[0] === '/api/timers',
          undefined,
          { revalidate: true }
        ),
      ]);

      setTitle('');
    } catch (error) {
      console.error('Failed to quick start task:', error);
    } finally {
      setIsCreating(false);
    }
  }, [title, isCreating, durationMinutes, activeTimers, mutate]);

  return (
    <View className="bg-card border border-border/60 rounded-xl p-3 mb-4">
      <Text className="text-sm font-medium mb-2">Quick Start</Text>
      <View className="flex-row items-center gap-2">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What would you like to focus on?"
          placeholderTextColor="#9ca3af"
          className="flex-1 bg-white px-3 py-2 rounded-xl text-foreground"
          style={{
            borderWidth: 1,
            borderColor: isFocused ? THEME.light.primary : THEME.light.border,
          }}
          returnKeyType="go"
          onSubmitEditing={handleQuickStart}
          editable={!isCreating}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <Pressable
          onPress={handleQuickStart}
          disabled={!title.trim() || isCreating}
          className={`h-10 w-10 rounded-full items-center justify-center ${
            title.trim() && !isCreating ? 'bg-green-700' : 'bg-muted'
          }`}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Play size={18} color={title.trim() ? 'white' : '#9ca3af'} fill={title.trim() ? 'white' : 'none'} />
          )}
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-2"
        contentContainerStyle={{ gap: 6 }}
      >
        {DURATION_OPTIONS.map((opt) => (
          <Pressable
            key={opt.minutes}
            onPress={() => setDurationMinutes(opt.minutes)}
            className={`px-3 py-1.5 rounded-full ${
              durationMinutes === opt.minutes
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                durationMinutes === opt.minutes
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
