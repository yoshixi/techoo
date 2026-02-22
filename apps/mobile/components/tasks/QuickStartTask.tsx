import { useState, useCallback } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Play } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import {
  postApiTasks,
  postApiTimers,
  getGetApiTasksKey,
  getGetApiTimersKey,
} from '@/gen/api/endpoints/comoriAPI.gen';
import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';

export function QuickStartTask() {
  const { mutate } = useSWRConfig();
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleQuickStart = useCallback(async () => {
    if (!title.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const now = new Date();
      // Create task with startAt = now
      const taskResponse = await postApiTasks({
        title: title.trim(),
        startAt: now.toISOString(),
      });

      // Start timer immediately
      await postApiTimers({
        taskId: taskResponse.task.id,
        startTime: now.toISOString(),
      });

      // Refresh both tasks and timers (use filter to match all task/timer queries)
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
  }, [title, isCreating, mutate]);

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
      <Text className="text-xs text-muted-foreground mt-2">
        Creates a task and starts your focus session
      </Text>
    </View>
  );
}
