import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Hash, X } from 'lucide-react-native';
import type { Todo } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import type { PostComposerContext } from '@/lib/postComposerContext';
import {
  pickRunningTodo,
  pickNextTimedTodo,
  DEFAULT_TODO_DURATION_SEC,
} from '@/lib/runningTodo';
import { usePeriodicNow } from '@/hooks/usePeriodicNow';

function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LogFocusStatusLine({ todos }: { todos: Todo[] }) {
  const now = usePeriodicNow();
  const running = pickRunningTodo(todos, now);
  const next = pickNextTimedTodo(todos, now);

  let main: string;
  if (running) {
    if (running.is_all_day === 1) {
      main = `Now · ${running.title} · All day`;
    } else if (running.starts_at != null) {
      const end =
        running.ends_at != null
          ? new Date(running.ends_at)
          : new Date(new Date(running.starts_at).getTime() + DEFAULT_TODO_DURATION_SEC * 1000);
      main = `Now · ${running.title} · until ${formatTimeShort(end)}`;
    } else {
      main = `Now · ${running.title}`;
    }
  } else if (next && next.starts_at != null) {
    main = `Next · ${next.title} · ${formatTimeShort(new Date(next.starts_at))}`;
  } else {
    main = 'No upcoming timed blocks';
  }

  return (
    <View className="mb-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2">
      <Text className="text-xs leading-snug text-foreground">{main}</Text>
    </View>
  );
}

export function LogComposerPanel({
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  logContext,
  onLogContextChange,
  todosForSuggestion,
  showStatusLine,
  todosForStatus,
  bottomInset,
  logInputRef,
}: {
  draft: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  logContext: PostComposerContext;
  onLogContextChange: (ctx: PostComposerContext) => void;
  todosForSuggestion: Todo[];
  showStatusLine?: boolean;
  todosForStatus?: Todo[];
  bottomInset: number;
  /** Optional ref to blur after submit (iOS keyboard UX). */
  logInputRef?: RefObject<TextInput | null>;
}) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const hashState = useMemo(() => {
    const cursor = selection.start;
    const before = draft.slice(0, cursor);
    const lastHash = before.lastIndexOf('#');
    if (lastHash === -1) return { active: false as const };
    const afterHash = before.slice(lastHash + 1);
    if (afterHash.includes(' ') || afterHash.includes('\n')) return { active: false as const };
    return { active: true as const, start: lastHash, query: afterHash.toLowerCase() };
  }, [draft, selection.start]);

  const filteredForHash = useMemo(() => {
    if (!hashState.active) return [];
    const q = hashState.query;
    if (!q) return todosForSuggestion;
    return todosForSuggestion.filter((t) => t.title.toLowerCase().includes(q));
  }, [hashState, todosForSuggestion]);

  const filteredForPicker = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return todosForSuggestion;
    return todosForSuggestion.filter((t) => t.title.toLowerCase().includes(q));
  }, [pickerQuery, todosForSuggestion]);

  const applyTodoContext = useCallback(
    (todo: Todo) => {
      onLogContextChange({ type: 'todo', id: todo.id, title: todo.title });
    },
    [onLogContextChange]
  );

  const handleSelectTodoFromHash = useCallback(
    (todo: Todo) => {
      if (!hashState.active) return;
      const { start: hashStart } = hashState;
      const cursor = selection.start;
      applyTodoContext(todo);
      const next = draft.slice(0, hashStart) + draft.slice(cursor);
      onDraftChange(next);
      setSelection({ start: hashStart, end: hashStart });
    },
    [hashState, draft, selection.start, onDraftChange, applyTodoContext]
  );

  const handleDraftChange = useCallback(
    (text: string) => {
      onDraftChange(text);
    },
    [onDraftChange]
  );

  const clearContext = useCallback(() => {
    onLogContextChange(null);
  }, [onLogContextChange]);

  return (
    <View style={{ paddingBottom: Math.max(bottomInset, 12) }}>
      {showStatusLine && todosForStatus ? <LogFocusStatusLine todos={todosForStatus} /> : null}

      {logContext ? (
        <View className="mb-2 flex-row items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <Text className="shrink-0 text-xs text-muted-foreground">Context</Text>
          <View className="min-w-0 max-w-[65%] shrink rounded-md bg-primary px-2 py-1">
            <Text
              className="text-xs font-medium text-primary-foreground"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {logContext.title}
            </Text>
          </View>
          <Pressable
            onPress={clearContext}
            hitSlop={8}
            accessibilityLabel="Remove context"
            className="shrink-0 p-1"
          >
            <X size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
      ) : null}

      <View className="mb-2 flex-row items-center justify-end">
        <Pressable
          onPress={() => {
            setPickerQuery('');
            setPickerOpen(true);
          }}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5"
        >
          <Hash size={14} className="text-muted-foreground" />
          <Text className="text-xs font-medium text-foreground">Link to-do</Text>
        </Pressable>
      </View>

      <TextInput
        ref={logInputRef}
        value={draft}
        onChangeText={handleDraftChange}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder="What happened?"
        placeholderTextColor="#9ca3af"
        multiline
        className="max-h-28 min-h-[56px] rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
        textAlignVertical="top"
      />

      {hashState.active && filteredForHash.length > 0 ? (
        <View className="mt-1 max-h-36 rounded-lg border border-border bg-card">
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={filteredForHash}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectTodoFromHash(item)}
                className="border-b border-border px-3 py-2.5 active:bg-muted"
              >
                <Text className="text-sm text-foreground" numberOfLines={2}>
                  {item.title}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <Pressable
        onPress={() => void onSubmit()}
        disabled={submitting || !draft.trim()}
        className="mt-2 items-center rounded-xl bg-primary py-2.5 disabled:opacity-50"
      >
        <Text className="text-sm font-semibold text-primary-foreground">
          {submitting ? 'Posting…' : 'Add to log'}
        </Text>
      </Pressable>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable className="flex-1" onPress={() => setPickerOpen(false)} />
          <View className="max-h-[70%] rounded-t-2xl border-t border-border bg-background px-4 pb-6 pt-3">
            <Text className="mb-2 text-center text-sm font-semibold text-foreground">
              Link to-do
            </Text>
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search…"
              placeholderTextColor="#9ca3af"
              className="mb-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
            />
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredForPicker}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={
                <Text className="py-4 text-center text-sm text-muted-foreground">
                  No open to-dos for this day.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    applyTodoContext(item);
                    setPickerOpen(false);
                    setPickerQuery('');
                  }}
                  className="border-b border-border py-3 active:bg-muted"
                >
                  <Text className="text-sm text-foreground">{item.title}</Text>
                </Pressable>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
