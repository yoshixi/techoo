import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Pressable,
  TextInput,
  Modal,
  Platform,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { useTodos } from '@/hooks/useTodos';
import { startOfLocalDay } from '@/lib/dayBounds';
import { formatTime } from '@/lib/time';
import type { Todo } from '@/gen/api/schemas';
import { postApiV1Posts } from '@/gen/api/endpoints/techooAPI.gen';

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

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const anchorDate = useMemo(() => {
    const parsed = params.date ? new Date(params.date) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [params.date]);

  const [date, setDate] = useState(() => startOfLocalDay(anchorDate));
  const [time, setTime] = useState(() => new Date());
  const [body, setBody] = useState('');
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [todoPickerOpen, setTodoPickerOpen] = useState(false);
  const [todoQuery, setTodoQuery] = useState('');
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { todos } = useTodos({ showAll: true });

  const filteredTodos = useMemo(() => {
    const q = todoQuery.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((t) => t.title.toLowerCase().includes(q));
  }, [todos, todoQuery]);

  const onPost = useCallback(async () => {
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      // API posts at server "now"; keep UI date/time fields as capture intent.
      await postApiV1Posts({
        body: text,
        event_ids: [],
        todo_ids: selectedTodo ? [selectedTodo.id] : [],
      });
      router.back();
    } catch {
      // API error is surfaced in customInstance; avoid unhandled promise rejection in UI event.
    } finally {
      setSubmitting(false);
    }
  }, [body, selectedTodo, router]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between border-b border-border/35 px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-muted-foreground">Cancel</Text>
        </Pressable>
        <Text className="text-base font-semibold text-foreground">New Post</Text>
        <Pressable onPress={() => void onPost()} disabled={submitting || !body.trim()}>
          <Text
            className={`text-base font-semibold ${
              submitting || !body.trim() ? 'text-muted-foreground' : 'text-primary'
            }`}
          >
            {submitting ? 'Posting...' : 'Post'}
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 px-4 pt-4">
        <Text className="mb-1 text-xs text-muted-foreground">Date</Text>
        <Pressable
          onPress={() => setPickerTarget('date')}
          className="mb-3 rounded-xl border border-border/40 bg-card/70 px-3 py-3"
        >
          <Text className="text-sm text-foreground">{date.toLocaleDateString()}</Text>
        </Pressable>

        <Text className="mb-1 text-xs text-muted-foreground">Time</Text>
        <Pressable
          onPress={() => setPickerTarget('time')}
          className="mb-3 rounded-xl border border-border/40 bg-card/70 px-3 py-3"
        >
          <Text className="text-sm text-foreground">{formatTime(mergeDateAndTime(date, time))}</Text>
        </Pressable>

        <Text className="mb-1 text-xs text-muted-foreground">Content</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What's happening?"
          placeholderTextColor="#9ca3af"
          multiline
          className="mb-3 min-h-[130px] rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
          textAlignVertical="top"
        />

        <Text className="mb-1 text-xs text-muted-foreground">Link ToDo (optional)</Text>
        <Pressable
          onPress={() => setTodoPickerOpen(true)}
          className="rounded-xl border border-border/40 bg-card/70 px-3 py-3"
        >
          <Text className="text-sm text-foreground">
            {selectedTodo ? selectedTodo.title : 'Select to-do'}
          </Text>
        </Pressable>
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
                value={pickerTarget === 'date' ? date : mergeDateAndTime(date, time)}
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
                    setTime(selected);
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

      <Modal
        visible={todoPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTodoPickerOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/35">
          <Pressable className="flex-1" onPress={() => setTodoPickerOpen(false)} />
          <View className="max-h-[70%] rounded-t-2xl border-t border-border/35 bg-background px-4 pb-5 pt-3">
            <Text className="mb-2 text-center text-sm font-semibold text-foreground">Select to-do</Text>
            <TextInput
              value={todoQuery}
              onChangeText={setTodoQuery}
              placeholder="Search..."
              placeholderTextColor="#9ca3af"
              className="mb-2 rounded-xl border border-border/40 bg-card/70 px-3 py-2 text-sm text-foreground"
            />
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredTodos}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <Text className="py-4 text-center text-sm text-muted-foreground">No open to-dos</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setSelectedTodo(item);
                    setTodoPickerOpen(false);
                    setTodoQuery('');
                  }}
                  className="border-b border-border/25 py-3 active:bg-muted/50"
                >
                  <Text className="text-sm text-foreground">{item.title}</Text>
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => {
                setSelectedTodo(null);
                setTodoPickerOpen(false);
                setTodoQuery('');
              }}
              className="mt-2 items-center py-2"
            >
              <Text className="text-sm text-muted-foreground">Clear selection</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      {submitting ? <ActivityIndicator className="pb-4" /> : null}
    </SafeAreaView>
  );
}
