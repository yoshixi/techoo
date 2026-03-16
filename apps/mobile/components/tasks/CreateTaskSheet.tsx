import { useState, useCallback, useEffect } from 'react';
import { View, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Calendar } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePostApiTasks } from '@/gen/api/endpoints/techoAPI.gen';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/time';

export interface CreateTaskSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-filled start time (e.g., from calendar drag selection) */
  initialStartAt?: Date | null;
  /** Pre-filled end time (used to calculate duration) */
  initialEndAt?: Date | null;
}

export function CreateTaskSheet({
  visible,
  onClose,
  initialStartAt,
  initialEndAt,
}: CreateTaskSheetProps) {
  const { mutate } = useSWRConfig();
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { trigger: createTask, isMutating } = usePostApiTasks();

  // Update startAt and endAt when initial values change
  useEffect(() => {
    if (visible) {
      if (initialStartAt) {
        setStartAt(initialStartAt);
      }
      if (initialEndAt) {
        setEndAt(initialEndAt);
      }
    }
  }, [visible, initialStartAt, initialEndAt]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;

    try {
      await createTask({
        title: title.trim(),
        startAt: startAt?.toISOString(),
        endAt: endAt?.toISOString(),
      });
      // Refresh all task queries (including filtered ones)
      await mutate(
        (key) => Array.isArray(key) && key[0] === '/api/tasks',
        undefined,
        { revalidate: true }
      );
      setTitle('');
      setStartAt(null);
      setEndAt(null);
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  }, [title, startAt, endAt, createTask, mutate, onClose]);

  const handleClose = useCallback(() => {
    setTitle('');
    setStartAt(null);
    setEndAt(null);
    onClose();
  }, [onClose]);

  const handleDateChange = useCallback((_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setStartAt(selectedDate);
    }
  }, []);

  const handleClearDate = useCallback(() => {
    setStartAt(null);
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={handleClose} hitSlop={10}>
            <X size={24} className="text-muted-foreground" />
          </Pressable>
          <Text className="font-semibold text-lg">New Task</Text>
          <View className="w-6" />
        </View>

        <View className="flex-1 p-4">
          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Title</Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="What needs to be done?"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm text-muted-foreground mb-2">Schedule</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm">Start Time</Text>
              <View className="flex-row items-center gap-2">
                {startAt && (
                  <Pressable onPress={handleClearDate}>
                    <X size={16} className="text-muted-foreground" />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="flex-row items-center gap-2 bg-muted px-3 py-2 rounded"
                >
                  <Calendar size={14} className="text-muted-foreground" />
                  <Text className="text-sm">
                    {startAt ? formatDateTime(startAt.toISOString()) : 'Set start time'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View className="p-4 border-t border-border">
          <Button onPress={handleCreate} disabled={!title.trim() || isMutating}>
            <Text className="text-primary-foreground font-medium">
              {isMutating ? 'Creating...' : 'Create Task'}
            </Text>
          </Button>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={startAt || new Date()}
            mode="datetime"
            display="spinner"
            onChange={handleDateChange}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
