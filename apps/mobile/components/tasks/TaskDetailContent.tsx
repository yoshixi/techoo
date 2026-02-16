import { useCallback, useState, useEffect } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Trash2, Check, Circle, Calendar } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  useGetApiTasksId,
  usePutApiTasksId,
  useDeleteApiTasksId,
  useGetApiTasksTaskIdTimers,
} from '@/gen/api/endpoints/shuchuAPI.gen';
import { Text } from '@/components/ui/text';
import { Input, TextArea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAutoSave } from '@/hooks/useAutoSave';
import { TimerDisplay } from '@/components/timer/TimerDisplay';
import { TimerControls } from '@/components/timer/TimerControls';
import { TimerHistory } from '@/components/timer/TimerHistory';
import { TagPicker } from '@/components/tags/TagPicker';
import { ActivityTimeline } from '@/components/activities/ActivityTimeline';
import { formatDateTime } from '@/lib/time';

export interface TaskDetailContentProps {
  taskId: string;
}

// Helper to refresh all task queries (including filtered ones)
const refreshAllTasks = (mutate: ReturnType<typeof useSWRConfig>['mutate']) =>
  mutate(
    (key) => Array.isArray(key) && key[0] === '/api/tasks',
    undefined,
    { revalidate: true }
  );

export function TaskDetailContent({ taskId }: TaskDetailContentProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const { data: taskData, isLoading, error } = useGetApiTasksId(taskId);
  const { data: timersData } = useGetApiTasksTaskIdTimers(taskId);
  const { trigger: updateTask } = usePutApiTasksId(taskId);
  const { trigger: deleteTask } = useDeleteApiTasksId(taskId);

  const task = taskData?.task;
  const timers = timersData?.timers ?? [];
  const activeTimer = timers.find((t) => !t.endTime);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'startAt' | 'dueDate'>('startAt');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  const handleSave = useCallback(
    async (data: { title?: string; description?: string }) => {
      if (!task) return;
      await updateTask(data);
      await refreshAllTasks(mutate);
    },
    [task, updateTask, mutate]
  );

  const { isPending: isTitlePending } = useAutoSave({
    value: title,
    onSave: (value) => handleSave({ title: value }),
    delay: 800,
    enabled: !!task && title !== task.title,
  });

  const { isPending: isDescriptionPending } = useAutoSave({
    value: description,
    onSave: (value) => handleSave({ description: value }),
    delay: 800,
    enabled: !!task && description !== (task.description || ''),
  });

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask({});
          await refreshAllTasks(mutate);
          router.back();
        },
      },
    ]);
  }, [deleteTask, mutate, router]);

  const handleToggleComplete = useCallback(async () => {
    if (!task) return;
    await updateTask({
      completedAt: task.completedAt ? null : new Date().toISOString(),
    });
    await refreshAllTasks(mutate);
  }, [task, updateTask, mutate]);

  const handleDateChange = useCallback(
    async (_event: any, selectedDate?: Date) => {
      setShowDatePicker(false);
      if (selectedDate && task) {
        const update =
          datePickerMode === 'startAt'
            ? { startAt: selectedDate.toISOString() }
            : { dueDate: selectedDate.toISOString() };
        await updateTask(update);
        await refreshAllTasks(mutate);
      }
    },
    [datePickerMode, task, updateTask, mutate]
  );

  const handleClearDate = useCallback(
    async (field: 'startAt' | 'dueDate') => {
      await updateTask({ [field]: null });
      await refreshAllTasks(mutate);
    },
    [updateTask, mutate]
  );

  const handleTagsChange = useCallback(
    async (tagIds: string[]) => {
      await updateTask({ tagIds });
      await refreshAllTasks(mutate);
    },
    [updateTask, mutate]
  );

  if (isLoading) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-destructive">Failed to load task</Text>
        <Button onPress={handleClose} className="mt-4">
          <Text>Go Back</Text>
        </Button>
      </View>
    );
  }

  const isCompleted = !!task.completedAt;

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable onPress={handleClose} hitSlop={10}>
          <X size={24} className="text-muted-foreground" />
        </Pressable>
        <View className="flex-row items-center gap-1">
          {(isTitlePending || isDescriptionPending) && (
            <Text className="text-xs text-muted-foreground">Saving...</Text>
          )}
        </View>
        <Pressable onPress={handleDelete} hitSlop={10}>
          <Trash2 size={20} className="text-destructive" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="p-4">
          {/* Complete Toggle & Title */}
          <View className="flex-row items-start gap-3 mb-4">
            <Pressable onPress={handleToggleComplete} className="mt-1">
              {isCompleted ? (
                <View className="h-6 w-6 rounded-full bg-primary items-center justify-center">
                  <Check size={14} color="white" />
                </View>
              ) : (
                <Circle size={24} className="text-muted-foreground" />
              )}
            </Pressable>
            <View className="flex-1">
              <Input
                value={title}
                onChangeText={setTitle}
                className="text-lg font-semibold border-0 p-0"
                placeholder="Task title"
              />
            </View>
          </View>

          {/* Timer Section */}
          <View className="bg-muted/30 rounded-lg p-4 mb-4">
            <TimerDisplay taskId={taskId} activeTimer={activeTimer} />
            <TimerControls taskId={taskId} activeTimer={activeTimer} />
          </View>

          <Separator className="my-4" />

          {/* Description */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Description</Text>
            <TextArea
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description..."
              className="min-h-[80px]"
            />
          </View>

          <Separator className="my-4" />

          {/* Schedule */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Schedule</Text>
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm">Start</Text>
                <View className="flex-row items-center gap-2">
                  {task.startAt && (
                    <Pressable onPress={() => handleClearDate('startAt')}>
                      <X size={16} className="text-muted-foreground" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      setDatePickerMode('startAt');
                      setShowDatePicker(true);
                    }}
                    className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded"
                  >
                    <Calendar size={14} className="text-muted-foreground" />
                    <Text className="text-sm">
                      {task.startAt ? formatDateTime(task.startAt) : 'Set start time'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm">Due</Text>
                <View className="flex-row items-center gap-2">
                  {task.dueDate && (
                    <Pressable onPress={() => handleClearDate('dueDate')}>
                      <X size={16} className="text-muted-foreground" />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      setDatePickerMode('dueDate');
                      setShowDatePicker(true);
                    }}
                    className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded"
                  >
                    <Calendar size={14} className="text-muted-foreground" />
                    <Text className="text-sm">
                      {task.dueDate ? formatDateTime(task.dueDate) : 'Set due date'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <Separator className="my-4" />

          {/* Tags */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Tags</Text>
            <TagPicker
              selectedTagIds={task.tags.map((t) => t.id)}
              onTagsChange={handleTagsChange}
            />
          </View>

          <Separator className="my-4" />

          {/* Timer History */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Timer History</Text>
            <TimerHistory timers={timers} />
          </View>

          <Separator className="my-4" />

          {/* Activity Timeline */}
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Activity</Text>
            <ActivityTimeline taskId={taskId} />
          </View>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === 'startAt'
              ? task.startAt
                ? new Date(task.startAt)
                : new Date()
              : task.dueDate
                ? new Date(task.dueDate)
                : new Date()
          }
          mode="datetime"
          display="spinner"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}
