import { useCallback, useRef, useState, useMemo } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { AlertTriangle, Check, Clock, Play, Square } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import type { Task, TaskTimer } from '@/gen/api/schemas';
import {
  putApiTasksId,
  postApiTimers,
  putApiTimersId,
  getGetApiTasksTaskIdTimersKey,
  getGetApiTimersKey,
} from '@/gen/api/endpoints/techoAPI.gen';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { useTimer } from '@/hooks/useTimer';
import { getRelativeTime } from '@/lib/time';

const FADE_OUT_DELAY = 1500; // Time before fade starts (ms)
const FADE_OUT_DURATION = 300; // Fade animation duration (ms)

export interface TaskListItemProps {
  task: Task;
  activeTimer?: TaskTimer;
  onPress: () => void;
  onComplete?: (task: Task) => void;
}

export function TaskListItem({ task, activeTimer, onPress, onComplete }: TaskListItemProps) {
  const { mutate } = useSWRConfig();
  const swipeableRef = useRef<Swipeable>(null);
  const [isHiding, setIsHiding] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const heightAnim = useRef(new Animated.Value(1)).current;

  const { formattedTime, isRunning, elapsedSeconds } = useTimer({
    startTime: activeTimer?.startTime,
    isActive: !!activeTimer && !activeTimer.endTime,
  });

  const isCompleted = !!task.completedAt;

  // Derive countdown from the task's planned window (startAt→endAt) vs actual elapsed time.
  // Uses task.startAt as the reference point for planned duration; falls back to the timer's
  // startTime if the task has no startAt (e.g., created without scheduling).
  // Returns null when there's no endAt — the task has no planned duration to count against.
  const countdownInfo = useMemo(() => {
    if (!isRunning || !task.endAt || !activeTimer?.startTime) return null;

    const endAt = new Date(task.endAt).getTime();
    const startAt = task.startAt ? new Date(task.startAt).getTime() : new Date(activeTimer.startTime).getTime();
    const plannedDurationSecs = Math.floor((endAt - startAt) / 1000);

    if (plannedDurationSecs <= 0) return null;

    const remainingSecs = plannedDurationSecs - elapsedSeconds;
    const isOverdue = remainingSecs < 0;
    const absSecs = Math.abs(remainingSecs);
    const mins = Math.floor(absSecs / 60);

    if (isOverdue) {
      return { label: `over by ${mins}m`, isOverdue: true };
    }
    return { label: `~${mins}m left`, isOverdue: false };
  }, [isRunning, task.endAt, task.startAt, activeTimer?.startTime, elapsedSeconds]);

  // Remove task from local cache without server revalidation
  const removeTaskFromCache = useCallback(() => {
    mutate(
      (key) => Array.isArray(key) && key[0] === '/api/tasks',
      (currentData: { tasks: Task[] } | undefined) => {
        if (!currentData) return currentData;
        return {
          ...currentData,
          tasks: currentData.tasks.filter((t) => t.id !== task.id),
        };
      },
      { revalidate: false }
    );
  }, [mutate, task.id]);

  const handleComplete = useCallback(async () => {
    swipeableRef.current?.close();

    // When onComplete is provided, delegate completion to the parent (TaskList) which
    // checks for timer records first and may show TimerFillSheet instead of completing
    // immediately. We only delegate on "complete" (not "undo"), so uncompleting always
    // works inline without the timer check.
    if (onComplete && !isCompleted) {
      onComplete(task);
      return;
    }

    const newCompletedAt = isCompleted ? null : new Date().toISOString();
    const wasCompleted = isCompleted;

    // Optimistically update all task caches without revalidation
    mutate(
      (key) => Array.isArray(key) && key[0] === '/api/tasks',
      (currentData: { tasks: Task[] } | undefined) => {
        if (!currentData) return currentData;
        return {
          ...currentData,
          tasks: currentData.tasks.map((t) =>
            t.id === task.id ? { ...t, completedAt: newCompletedAt } : t
          ),
        };
      },
      { revalidate: false }
    );

    // If completing (not uncompleting), start fade-out animation after delay
    if (!wasCompleted) {
      setTimeout(() => {
        setIsHiding(true);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: FADE_OUT_DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: 0,
            duration: FADE_OUT_DURATION,
            useNativeDriver: false,
          }),
        ]).start(() => {
          // After animation, remove from local cache (no server fetch)
          removeTaskFromCache();
        });
      }, FADE_OUT_DELAY);
    }

    // Update the server in the background
    try {
      await putApiTasksId(task.id, { completedAt: newCompletedAt });
    } catch (error) {
      // Revert on error
      setIsHiding(false);
      fadeAnim.setValue(1);
      heightAnim.setValue(1);
      mutate(
        (key) => Array.isArray(key) && key[0] === '/api/tasks',
        undefined,
        { revalidate: true }
      );
    }
  }, [isCompleted, task, onComplete, mutate, fadeAnim, heightAnim, removeTaskFromCache]);

  const handleToggleTimer = useCallback(async () => {
    swipeableRef.current?.close();

    try {
      if (isRunning && activeTimer) {
        await putApiTimersId(activeTimer.id, { endTime: new Date().toISOString() });
      } else {
        await postApiTimers({ taskId: task.id, startTime: new Date().toISOString() });
      }
      await mutate(getGetApiTasksTaskIdTimersKey(task.id));
      await mutate(getGetApiTimersKey());
    } catch (error) {
      // Silently fail — user can retry
    }
  }, [isRunning, activeTimer, task.id, mutate]);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        onPress={handleToggleTimer}
        className={`${isRunning ? 'bg-destructive' : 'bg-primary'} justify-center items-center rounded-lg mb-2 px-6`}
      >
        <Animated.View
          style={{ transform: [{ scale }], opacity }}
          className="items-center"
        >
          {isRunning ? (
            <Square size={24} color="white" fill="white" />
          ) : (
            <Play size={24} color="white" fill="white" />
          )}
          <Text className="text-white text-xs mt-1 font-medium">
            {isRunning ? 'Stop' : 'Start'}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [0, 50, 100],
      outputRange: [0, 0.8, 1],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        onPress={handleComplete}
        className="bg-green-700 justify-center items-center rounded-lg mb-2 px-6"
      >
        <Animated.View
          style={{ transform: [{ scale }], opacity }}
          className="items-center"
        >
          <Check size={24} color="white" />
          <Text className="text-white text-xs mt-1 font-medium">
            {isCompleted ? 'Undo' : 'Done'}
          </Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scaleY: heightAnim }],
        marginBottom: heightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        renderLeftActions={renderLeftActions}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') {
            handleToggleTimer();
          } else {
            handleComplete();
          }
        }}
        overshootRight={false}
        overshootLeft={false}
        friction={2}
        enabled={!isHiding}
      >
        <Pressable
          onPress={onPress}
          disabled={isHiding}
          className="flex-row items-start gap-3 py-3 px-3 bg-card rounded-lg mb-2 border border-border active:opacity-70"
        >
          <View className="flex-1">
            <Text
              className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}
              numberOfLines={2}
            >
              {task.title}
            </Text>

            {task.description && (
              <Text className="text-sm text-muted-foreground mt-1" numberOfLines={1}>
                {task.description}
              </Text>
            )}

            <View className="flex-row flex-wrap items-center gap-2 mt-2">
              {task.tags.map((tag) => (
                <Badge key={tag.id} label={tag.name} variant="secondary" />
              ))}

              {task.startAt && (
                <View className="flex-row items-center gap-1">
                  <Clock size={12} className="text-muted-foreground" />
                  <Text className="text-xs text-muted-foreground">
                    {getRelativeTime(task.startAt)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {isRunning && (
            <View className="items-end gap-1">
              <View className="bg-green-200 dark:bg-green-900 px-2 py-1 rounded">
                <Text className="text-green-800 dark:text-green-300 text-sm font-mono">
                  {formattedTime}
                </Text>
              </View>
              {countdownInfo && (
                <View
                  className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded ${
                    countdownInfo.isOverdue
                      ? 'bg-amber-100 dark:bg-amber-900'
                      : 'bg-green-100 dark:bg-green-900/50'
                  }`}
                >
                  {countdownInfo.isOverdue && (
                    <AlertTriangle size={10} color="#b45309" />
                  )}
                  <Text
                    className={`text-xs ${
                      countdownInfo.isOverdue
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-green-700 dark:text-green-400'
                    }`}
                  >
                    {countdownInfo.label}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}
