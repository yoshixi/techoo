import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, Pressable, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { X, Trash2, CheckCircle, Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { MarkdownComposer } from '@/components/markdown/MarkdownComposer';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTodos } from '@/hooks/useTodos';
import { usePosts } from '@/hooks/usePosts';
import { useAutoSave } from '@/hooks/useAutoSave';
import { formatDateTime } from '@/lib/time';
import {
  buildScheduleUpdate,
  durationMinutes,
  scheduleDraftEqualsTodo,
  scheduleDraftFromTodo,
  type DurationPreset,
  type TodoScheduleMode,
} from '@/lib/todoSchedule';
import { TodoScheduleFields } from '@/components/todos/TodoScheduleFields';
import type { Post, Todo } from '@/gen/api/schemas';

export interface TodoDetailContentProps {
  todoId: number;
}

const TITLE_INPUT_MIN_HEIGHT = 48;
const TITLE_INPUT_VERTICAL_PADDING = 16;
const TITLE_CHARS_PER_LINE = 32;
const TITLE_LINE_HEIGHT = 26;

function estimateTitleInputHeight(text: string): number {
  const lineCount = text.split('\n').reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / TITLE_CHARS_PER_LINE)),
    0
  );
  return Math.max(TITLE_INPUT_MIN_HEIGHT, lineCount * TITLE_LINE_HEIGHT + TITLE_INPUT_VERTICAL_PADDING);
}

export function TodoDetailContent({ todoId }: TodoDetailContentProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const { todos, isLoading, error, updateTodo, toggleDone, deleteTodo } = useTodos({ fetchAll: true });
  const todo = todos.find((t) => t.id === todoId) ?? null;

  /** Survives brief SWR gaps during global revalidation so the screen doesn’t flash to skeleton. */
  const lastGoodTodoRef = useRef<{ id: number; todo: Todo } | null>(null);
  const prevTodoIdRef = useRef(todoId);
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    if (prevTodoIdRef.current !== todoId) {
      lastGoodTodoRef.current = null;
      prevTodoIdRef.current = todoId;
      allowLeaveRef.current = false;
    }
    if (todo) {
      lastGoodTodoRef.current = { id: todoId, todo };
    }
  }, [todo, todoId]);

  useEffect(() => {
    if (isLoading || todo != null) return;
    if (todos.length > 0 && !todos.some((t) => t.id === todoId)) {
      lastGoodTodoRef.current = null;
    }
  }, [isLoading, todo, todos, todoId]);

  const resolvedTodo =
    todo ?? (lastGoodTodoRef.current?.id === todoId ? lastGoodTodoRef.current.todo : null);

  const [title, setTitle] = useState('');
  const [titleInputHeight, setTitleInputHeight] = useState(TITLE_INPUT_MIN_HEIGHT);
  const [description, setDescription] = useState('');
  const [scheduleMode, setScheduleMode] = useState<TodoScheduleMode>('later');
  const [scheduleDate, setScheduleDate] = useState(() => new Date());
  const [scheduleStartTime, setScheduleStartTime] = useState(() => new Date());
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('30');
  const [customDurationMin, setCustomDurationMin] = useState('45');
  const [scheduleFeedback, setScheduleFeedback] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingScheduleRef = useRef(false);

  const clearSavedTimer = useCallback(() => {
    if (savedClearTimerRef.current) {
      clearTimeout(savedClearTimerRef.current);
      savedClearTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSavedTimer(), [clearSavedTimer]);

  const scheduleDraft = useMemo(
    () => ({
      mode: scheduleMode,
      date: scheduleDate,
      startTime: scheduleStartTime,
      durationPreset,
      customDurationMin,
    }),
    [scheduleMode, scheduleDate, scheduleStartTime, durationPreset, customDurationMin]
  );

  const isScheduleDirty = useMemo(
    () => resolvedTodo != null && !scheduleDraftEqualsTodo(scheduleDraft, resolvedTodo),
    [scheduleDraft, resolvedTodo]
  );

  const canApplySchedule =
    isScheduleDirty &&
    (scheduleMode !== 'timed' || durationMinutes(durationPreset, customDurationMin) > 0);

  const applyScheduleDraft = useCallback(async (): Promise<boolean> => {
    if (!resolvedTodo || !canApplySchedule) return false;
    if (applyingScheduleRef.current) return false;

    applyingScheduleRef.current = true;
    clearSavedTimer();
    setScheduleFeedback('saving');
    try {
      const payload = buildScheduleUpdate(
        scheduleMode,
        scheduleDate,
        scheduleStartTime,
        durationMinutes(durationPreset, customDurationMin)
      );
      await updateTodo(resolvedTodo.id, payload);
      setScheduleFeedback('saved');
      savedClearTimerRef.current = setTimeout(() => {
        setScheduleFeedback('idle');
        savedClearTimerRef.current = null;
      }, 1600);
      return true;
    } catch {
      setScheduleFeedback('idle');
      return false;
    } finally {
      applyingScheduleRef.current = false;
    }
  }, [
    resolvedTodo,
    canApplySchedule,
    scheduleMode,
    scheduleDate,
    scheduleStartTime,
    durationPreset,
    customDurationMin,
    updateTodo,
    clearSavedTimer,
  ]);

  const revertScheduleDraft = useCallback(() => {
    if (!resolvedTodo) return;
    const saved = scheduleDraftFromTodo(resolvedTodo);
    setScheduleMode(saved.mode);
    setScheduleDate(saved.date);
    setScheduleStartTime(saved.startTime);
    setDurationPreset(saved.durationPreset);
    setCustomDurationMin(saved.customDurationMin);
    setScheduleFeedback('idle');
  }, [resolvedTodo]);

  const proceedLeave = useCallback(
    (action: () => void) => {
      allowLeaveRef.current = true;
      action();
    },
    []
  );

  const confirmDiscardSchedule = useCallback(
    (onProceed: () => void) => {
      Alert.alert(
        'Unsaved schedule',
        'Apply your schedule changes before leaving?',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => proceedLeave(onProceed),
          },
          {
            text: 'Apply',
            onPress: () => {
              void (async () => {
                const ok = await applyScheduleDraft();
                if (ok) proceedLeave(onProceed);
              })();
            },
          },
        ]
      );
    },
    [applyScheduleDraft, proceedLeave]
  );

  const requestClose = useCallback(() => {
    if (!isScheduleDirty) {
      proceedLeave(() => router.back());
      return;
    }
    confirmDiscardSchedule(() => proceedLeave(() => router.back()));
  }, [isScheduleDirty, confirmDiscardSchedule, proceedLeave, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !isScheduleDirty) return;
      event.preventDefault();
      confirmDiscardSchedule(() => proceedLeave(() => navigation.dispatch(event.data.action)));
    });
    return unsubscribe;
  }, [navigation, isScheduleDirty, confirmDiscardSchedule, proceedLeave]);

  // Sync from server when not editing schedule draft locally.
  useEffect(() => {
    if (!resolvedTodo || scheduleFeedback === 'saving') return;
    setTitle(resolvedTodo.title);
    setDescription(resolvedTodo.description ?? '');
    if (!isScheduleDirty) {
      const saved = scheduleDraftFromTodo(resolvedTodo);
      setScheduleMode(saved.mode);
      setScheduleDate(saved.date);
      setScheduleStartTime(saved.startTime);
      setDurationPreset(saved.durationPreset);
      setCustomDurationMin(saved.customDurationMin);
    }
  }, [
    todoId,
    resolvedTodo?.title,
    resolvedTodo?.description,
    resolvedTodo?.starts_at,
    resolvedTodo?.ends_at,
    resolvedTodo?.is_all_day,
    resolvedTodo?.created_at,
    scheduleFeedback,
    isScheduleDirty,
  ]);

  useEffect(() => {
    if (!resolvedTodo) return;
    setTitleInputHeight(estimateTitleInputHeight(resolvedTodo.title));
  }, [todoId, resolvedTodo?.title]);

  const handleSaveTitle = useCallback(
    async (value: string) => {
      if (!resolvedTodo || !value.trim()) return;
      await updateTodo(resolvedTodo.id, { title: value.trim() });
    },
    [resolvedTodo, updateTodo]
  );

  const { isPending, isSaving } = useAutoSave({
    value: title,
    onSave: handleSaveTitle,
    delay: 800,
    enabled:
      !!resolvedTodo && title.trim().length > 0 && title !== resolvedTodo.title,
  });

  const titleSaving = isPending || isSaving;
  const {
    isPending: isDescriptionPending,
    isSaving: isDescriptionSaving,
  } = useAutoSave({
    value: description,
    onSave: async (value: string) => {
      if (!resolvedTodo) return;
      await updateTodo(resolvedTodo.id, { description: value.trim() ? value.trim() : null });
    },
    delay: 900,
    enabled: !!resolvedTodo && description !== (resolvedTodo.description ?? ''),
  });
  const detailRange = useMemo(
    () => {
      const end = new Date();
      end.setDate(end.getDate() + 1);
      const start =
        resolvedTodo?.created_at != null
          ? new Date(new Date(resolvedTodo.created_at).getTime() - 86400_000 * 30)
          : new Date(end.getTime() - 86400_000 * 180);
      return {
        from: start,
        to: end,
        limit: 2000,
      };
    },
    [resolvedTodo?.created_at]
  );
  const { posts, isLoading: postsLoading, createPost } = usePosts(detailRange);
  const relatedPosts = useMemo(
    () =>
      [...posts]
        .filter((p) => p.todos.some((t) => t.id === todoId))
        .sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()),
    [posts, todoId]
  );
  const [threadDraft, setThreadDraft] = useState('');
  const [postingThread, setPostingThread] = useState(false);
  const addThreadPost = useCallback(async () => {
    const body = threadDraft.trim();
    if (!body) return;
    setPostingThread(true);
    try {
      await createPost(body, [], [todoId]);
      setThreadDraft('');
    } catch {
      // API error is surfaced in customInstance; avoid unhandled promise rejection in UI event.
    } finally {
      setPostingThread(false);
    }
  }, [threadDraft, createPost, todoId]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete to-do', 'Remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTodo(todoId);
            router.back();
          } catch {
            /* failure reported in customInstance */
          }
        },
      },
    ]);
  }, [deleteTodo, todoId, router]);

  const handleToggleDone = useCallback(async () => {
    if (!resolvedTodo) return;
    await toggleDone(resolvedTodo.id, resolvedTodo.done);
  }, [resolvedTodo, toggleDone]);

  if (isLoading && resolvedTodo == null) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton className="mb-2 h-4 w-full" />
      </View>
    );
  }

  if (resolvedTodo == null) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-destructive">
          {error ? 'Could not load to-do' : 'To-do not found'}
        </Text>
        <Button onPress={requestClose} className="mt-4">
          <Text>Go back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border/35 px-4 py-3">
        <Pressable onPress={requestClose} hitSlop={10}>
          <X size={24} className="text-muted-foreground" />
        </Pressable>
        <View className="min-w-[88px] flex-row items-center justify-end gap-3">
          {titleSaving || isDescriptionPending || isDescriptionSaving || scheduleFeedback === 'saving' ? (
            <Text className="text-xs text-muted-foreground">Saving…</Text>
          ) : scheduleFeedback === 'saved' ? (
            <Check size={20} className="text-green-600" />
          ) : null}
          <Pressable onPress={() => void handleToggleDone()} hitSlop={10}>
            <CheckCircle
              size={22}
              className={resolvedTodo.done === 1 ? 'text-green-600' : 'text-muted-foreground'}
            />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Trash2 size={20} className="text-destructive" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="mb-1 text-xs text-muted-foreground">Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          placeholderTextColor="#9ca3af"
          onContentSizeChange={(event) => {
            setTitleInputHeight(
              Math.max(
                TITLE_INPUT_MIN_HEIGHT,
                event.nativeEvent.contentSize.height + TITLE_INPUT_VERTICAL_PADDING
              )
            );
          }}
          style={{ height: titleInputHeight }}
          className="mb-4 rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground native:text-lg native:leading-[1.25]"
        />

        <Text className="mb-1 text-xs text-muted-foreground">Description</Text>
        <View className="mb-4">
          <MarkdownComposer
            value={description}
            onChange={setDescription}
            placeholder="Description, context, links..."
            minHeight={120}
            inputClassName="min-h-[120px] rounded-xl border border-input/45 bg-card/60 px-3 py-2 text-base text-foreground"
          />
        </View>

        <TodoScheduleFields
          mode={scheduleMode}
          onModeChange={setScheduleMode}
          date={scheduleDate}
          onDateChange={setScheduleDate}
          startTime={scheduleStartTime}
          onStartTimeChange={setScheduleStartTime}
          durationPreset={durationPreset}
          onDurationPresetChange={setDurationPreset}
          customDurationMin={customDurationMin}
          onCustomDurationMinChange={setCustomDurationMin}
        />

        {isScheduleDirty ? (
          <View className="-mt-3 mb-6 flex-row items-center justify-end gap-3">
            <Pressable onPress={revertScheduleDraft} hitSlop={8}>
              <Text className="text-xs font-medium text-muted-foreground">Revert</Text>
            </Pressable>
            <Pressable
              disabled={!canApplySchedule || scheduleFeedback === 'saving'}
              onPress={() => void applyScheduleDraft()}
              hitSlop={8}
            >
              <Text
                className={`text-xs font-semibold ${
                  canApplySchedule && scheduleFeedback !== 'saving'
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {scheduleFeedback === 'saving' ? 'Applying…' : 'Apply'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mb-6">
          <Text className="mb-2 text-xs text-muted-foreground">Related posts</Text>
          {postsLoading && relatedPosts.length === 0 ? (
            <Text className="text-xs text-muted-foreground">Loading posts…</Text>
          ) : relatedPosts.length === 0 ? (
            <Text className="text-xs text-muted-foreground">No posts linked yet.</Text>
          ) : (
            <View className="gap-2">
              {relatedPosts.map((post: Post) => (
                <View
                  key={post.id}
                  className="rounded-lg border border-border/35 bg-card/60 px-3 py-2.5"
                >
                  <MarkdownView content={post.body} />
                  <Text className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(post.posted_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View className="mt-3">
            <Text className="mb-1 text-xs text-muted-foreground">Add to thread</Text>
            <MarkdownComposer
              value={threadDraft}
              onChange={setThreadDraft}
              placeholder="Write a related post..."
              minHeight={76}
              inputClassName="min-h-[76px] rounded-xl border border-input/45 bg-card/60 px-3 py-2 text-sm text-foreground"
            />
            <Button
              className="mt-2 self-start"
              onPress={() => void addThreadPost()}
              disabled={postingThread || !threadDraft.trim()}
            >
              <Text>{postingThread ? 'Posting…' : 'Post to thread'}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
