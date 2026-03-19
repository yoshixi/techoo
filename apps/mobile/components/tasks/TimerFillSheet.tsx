import { useState, useCallback, useEffect } from 'react';
import { View, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Clock, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSWRConfig } from 'swr';
import type { Task } from '@/gen/api/schemas';
import {
  postApiTimers,
  putApiTimersId,
  putApiTasksId,
} from '@/gen/api/endpoints/techooAPI.gen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/time';

export interface TimerFillSheetProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
}

export function TimerFillSheet({ visible, task, onClose }: TimerFillSheetProps) {
  const { mutate } = useSWRConfig();
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill start/end from the task's scheduled window so the user doesn't
  // have to enter times from scratch. For endTime, we cap at "now" because
  // a task scheduled for the future (endAt > now) shouldn't pre-fill a
  // future end time — the user is completing it right now.
  useEffect(() => {
    if (visible && task) {
      const now = new Date();
      if (task.startAt) {
        setStartTime(new Date(task.startAt));
      } else {
        setStartTime(new Date(now.getTime() - 60 * 60 * 1000));
      }
      if (task.endAt) {
        const end = new Date(task.endAt);
        setEndTime(end > now ? now : end);
      } else {
        setEndTime(now);
      }
    }
  }, [visible, task]);

  const durationMinutes = Math.max(
    0,
    Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  );

  const handleRecordAndComplete = useCallback(async () => {
    if (!task || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // The API only accepts startTime on creation, so we create the timer
      // first, then immediately stop it with the user-selected endTime.
      const timerResponse = await postApiTimers({
        taskId: task.id,
        startTime: startTime.toISOString(),
      });

      await putApiTimersId(timerResponse.timer.id, {
        endTime: endTime.toISOString(),
      });

      await putApiTasksId(task.id, {
        completedAt: new Date().toISOString(),
      });

      // Refresh caches
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

      onClose();
    } catch (error) {
      console.error('Failed to record timer and complete:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [task, startTime, endTime, isSubmitting, mutate, onClose]);

  const handleSkip = useCallback(async () => {
    if (!task || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Just complete the task without recording time
      await putApiTasksId(task.id, {
        completedAt: new Date().toISOString(),
      });

      await mutate(
        (key) => Array.isArray(key) && key[0] === '/api/tasks',
        undefined,
        { revalidate: true }
      );

      onClose();
    } catch (error) {
      console.error('Failed to complete task:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [task, isSubmitting, mutate, onClose]);

  if (!task) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} className="text-muted-foreground" />
          </Pressable>
          <Text className="font-semibold text-lg">Log Time</Text>
          <View className="w-6" />
        </View>

        <View className="flex-1 p-4">
          <View className="bg-muted/50 rounded-xl p-4 mb-6">
            <View className="flex-row items-center gap-2 mb-2">
              <Clock size={16} className="text-primary" />
              <Text className="font-medium">No time recorded</Text>
            </View>
            <Text className="text-sm text-muted-foreground">
              You're completing "{task.title}" without any timer records. Would
              you like to log the time you spent?
            </Text>
          </View>

          <View className="gap-4">
            <View>
              <Text className="text-sm text-muted-foreground mb-2">
                Start Time
              </Text>
              <Pressable
                onPress={() => setShowStartPicker(true)}
                className="bg-card border border-border rounded-lg px-4 py-3"
              >
                <Text className="text-base">{formatTime(startTime)}</Text>
              </Pressable>
            </View>

            <View>
              <Text className="text-sm text-muted-foreground mb-2">
                End Time
              </Text>
              <Pressable
                onPress={() => setShowEndPicker(true)}
                className="bg-card border border-border rounded-lg px-4 py-3"
              >
                <Text className="text-base">{formatTime(endTime)}</Text>
              </Pressable>
            </View>

            <View className="bg-primary/10 rounded-lg px-4 py-3">
              <Text className="text-primary font-medium text-center">
                Duration: {durationMinutes} min
              </Text>
            </View>
          </View>
        </View>

        <View className="p-4 border-t border-border gap-2">
          <Button onPress={handleRecordAndComplete} disabled={isSubmitting || durationMinutes <= 0}>
            <Text className="text-primary-foreground font-medium">
              {isSubmitting ? 'Recording...' : 'Record & Complete'}
            </Text>
          </Button>
          <Pressable
            onPress={handleSkip}
            disabled={isSubmitting}
            className="py-3 items-center"
          >
            <Text className="text-muted-foreground text-sm">
              Skip - complete without logging
            </Text>
          </Pressable>
        </View>

        {showStartPicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="spinner"
            onChange={(_event, date) => {
              setShowStartPicker(false);
              if (date) setStartTime(date);
            }}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="spinner"
            onChange={(_event, date) => {
              setShowEndPicker(false);
              if (date) setEndTime(date);
            }}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
