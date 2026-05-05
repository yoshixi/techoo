import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/time';

export interface CreateTodoSheetProps {
  visible: boolean;
  onClose: () => void;
  initialStartAt?: Date | null;
  initialEndAt?: Date | null;
  onCreate: (title: string, startsAt?: Date, endsAt?: Date) => Promise<void>;
}

export function CreateTodoSheet({
  visible,
  onClose,
  initialStartAt,
  initialEndAt,
  onCreate,
}: CreateTodoSheetProps) {
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (visible && !wasVisible.current) {
      setTitle('');
      setStartAt(initialStartAt ?? null);
      setEndAt(initialEndAt ?? null);
    }
    wasVisible.current = visible;
  }, [visible, initialStartAt, initialEndAt]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onCreate(title.trim(), startAt ?? undefined, endAt ?? initialEndAt ?? undefined);
      setTitle('');
      setStartAt(null);
      setEndAt(null);
      onClose();
    } finally {
      setSaving(false);
    }
  }, [title, startAt, endAt, initialEndAt, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setTitle('');
    setStartAt(null);
    setEndAt(null);
    onClose();
  }, [onClose]);

  const handleDateChange = useCallback((_event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setStartAt(selectedDate);
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
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Pressable onPress={handleClose} hitSlop={10}>
            <X size={24} className="text-muted-foreground" />
          </Pressable>
          <Text className="text-lg font-semibold">New to-do</Text>
          <View className="w-6" />
        </View>

        <View className="flex-1 p-4">
          <View className="mb-4">
            <Text className="mb-2 text-sm text-muted-foreground">Title</Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="What are you planning?"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleCreate()}
            />
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-sm text-muted-foreground">Start</Text>
            <View className="flex-row items-center justify-between">
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="flex-row items-center gap-2 rounded bg-muted px-3 py-2"
              >
                <Calendar size={14} className="text-muted-foreground" />
                <Text className="text-sm">
                  {startAt ? formatDateTime(startAt.toISOString()) : 'Set start time'}
                </Text>
              </Pressable>
              {startAt ? (
                <Pressable onPress={() => setStartAt(null)} hitSlop={8}>
                  <X size={16} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View className="border-t border-border p-4">
          <Button onPress={() => void handleCreate()} disabled={!title.trim() || saving}>
            <Text className="font-medium text-primary-foreground">{saving ? 'Saving…' : 'Create'}</Text>
          </Button>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={startAt || new Date()}
            mode="datetime"
            display="spinner"
            onChange={handleDateChange}
          />
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
