import { useCallback, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
} from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import type { Task } from '@/gen/api/schemas';
import { putApiTasksId } from '@/gen/api/endpoints/techooAPI.gen';
import { Text } from '@/components/ui/text';

export interface CarryoverSectionProps {
  tasks: Task[];
  onComplete?: (task: Task) => void;
}

export function CarryoverSection({ tasks, onComplete }: CarryoverSectionProps) {
  const { mutate } = useSWRConfig();
  const [isExpanded, setIsExpanded] = useState(true);
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);

  const revalidateTasks = useCallback(() => {
    return mutate(
      (key) => Array.isArray(key) && key[0] === '/api/tasks',
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  const handleMoveToToday = useCallback(
    async (task: Task) => {
      setLoadingTaskId(task.id);
      try {
        const now = new Date();
        // Preserve original duration or default to 30 min
        let durationMs = 30 * 60 * 1000;
        if (task.startAt && task.endAt) {
          const originalDuration =
            new Date(task.endAt).getTime() - new Date(task.startAt).getTime();
          if (originalDuration > 0) {
            durationMs = originalDuration;
          }
        }

        await putApiTasksId(task.id, {
          startAt: now.toISOString(),
          endAt: new Date(now.getTime() + durationMs).toISOString(),
        });

        await revalidateTasks();
      } catch (error) {
        console.error('Failed to move task to today:', error);
      } finally {
        setLoadingTaskId(null);
      }
    },
    [revalidateTasks]
  );

  // "Skip" clears the schedule entirely (sets startAt/endAt to null),
  // moving the task to the "Other Tasks" (unscheduled) bucket. The task
  // remains incomplete so the user can reschedule it later.
  const handleSkip = useCallback(
    async (task: Task) => {
      setLoadingTaskId(task.id);
      try {
        await putApiTasksId(task.id, {
          startAt: null,
          endAt: null,
        });

        await revalidateTasks();
      } catch (error) {
        console.error('Failed to skip task:', error);
      } finally {
        setLoadingTaskId(null);
      }
    },
    [revalidateTasks]
  );

  const handleDone = useCallback(
    (task: Task) => {
      if (onComplete) {
        onComplete(task);
      }
    },
    [onComplete]
  );

  if (tasks.length === 0) return null;

  return (
    <View className="mb-4">
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        className="flex-row items-center justify-between mb-2"
      >
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-amber-500" />
          <Text className="font-semibold text-sm text-amber-700 dark:text-amber-400">
            Carryover
          </Text>
          <View className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full">
            <Text className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              {tasks.length}
            </Text>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </Pressable>

      {isExpanded && (
        <View className="gap-2">
          {tasks.map((task) => {
            const isLoading = loadingTaskId === task.id;

            return (
              <View
                key={task.id}
                className="bg-card border border-amber-200 dark:border-amber-800 rounded-lg p-3"
              >
                <Text className="font-medium mb-2" numberOfLines={2}>
                  {task.title}
                </Text>

                {isLoading ? (
                  <View className="py-2 items-center">
                    <ActivityIndicator size="small" />
                  </View>
                ) : (
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => handleMoveToToday(task)}
                      className="flex-1 flex-row items-center justify-center gap-1.5 bg-primary/10 rounded-lg py-2"
                    >
                      <ArrowRight size={14} className="text-primary" />
                      <Text className="text-xs font-medium text-primary">
                        Today
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleSkip(task)}
                      className="flex-1 flex-row items-center justify-center gap-1.5 bg-muted rounded-lg py-2"
                    >
                      <X size={14} className="text-muted-foreground" />
                      <Text className="text-xs font-medium text-muted-foreground">
                        Skip
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleDone(task)}
                      className="flex-1 flex-row items-center justify-center gap-1.5 bg-green-100 dark:bg-green-900 rounded-lg py-2"
                    >
                      <Check size={14} className="text-green-700 dark:text-green-300" />
                      <Text className="text-xs font-medium text-green-700 dark:text-green-300">
                        Done
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
