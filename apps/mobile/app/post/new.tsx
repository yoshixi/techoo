import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Pressable,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Text } from '@/components/ui/text';
import { useTodos } from '@/hooks/useTodos';
import { usePostLists } from '@/hooks/usePostLists';
import { startOfLocalDay } from '@/lib/dayBounds';
import { formatTime } from '@/lib/time';
import { PostComposerAssociationsBar } from '@/components/posts/PostComposerAssociationsBar';
import { MarkdownFormatToolbar } from '@/components/markdown/MarkdownFormatToolbar';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import {
  PostHashSuggestions,
  applyHashSuggestion,
  buildHashSuggestions,
  getHashQuery,
  removeHashToken,
} from '@/components/posts/PostHashSuggestions';
import {
  associationsFromTimelineTab,
  createPostWithAssociations,
  emptyPostComposerAssociations,
  parseAssociationsParam,
  type PostComposerAssociations,
} from '@/lib/postComposerAssociations';
import { parseTimelineTabParam } from '@/lib/timelineTab';
import { showApiError } from '@/lib/showApiError';

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
  const params = useLocalSearchParams<{ date?: string; tab?: string; associations?: string }>();
  const anchorDate = useMemo(() => {
    const parsed = params.date ? new Date(params.date) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [params.date]);

  const { lists } = usePostLists();
  const { todos } = useTodos({ showAll: true });

  const initialAssociations = useMemo((): PostComposerAssociations => {
    const fromParam = parseAssociationsParam(params.associations);
    if (fromParam) return fromParam;
    const tab = parseTimelineTabParam(params.tab);
    if (tab) return associationsFromTimelineTab(tab, lists);
    return emptyPostComposerAssociations();
  }, [lists, params.associations, params.tab]);

  const [date, setDate] = useState(() => startOfLocalDay(anchorDate));
  const [time, setTime] = useState(() => new Date());
  const [body, setBody] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false);
  const [associations, setAssociations] = useState<PostComposerAssociations>(initialAssociations);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (params.associations) return;
    const tab = parseTimelineTabParam(params.tab);
    if (!tab) return;
    setAssociations(associationsFromTimelineTab(tab, lists));
  }, [lists, params.associations, params.tab]);

  const hashState = useMemo(
    () => getHashQuery(body, selection.start),
    [body, selection.start]
  );
  const hashSuggestions = useMemo(() => {
    if (!hashState.active) return [];
    return buildHashSuggestions(hashState.query, associations, lists, todos);
  }, [associations, hashState.active, hashState.query, lists, todos]);

  const onSelectHashSuggestion = useCallback(
    (item: Parameters<typeof applyHashSuggestion>[1]) => {
      setAssociations((current) => applyHashSuggestion(current, item));
      if (hashState.active) {
        setBody(removeHashToken(body, hashState.start, selection.start));
      }
    },
    [body, hashState.active, hashState.start, selection.start]
  );

  const onPost = useCallback(async () => {
    const text = body.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await createPostWithAssociations(text, associations);
      router.back();
    } catch (err) {
      showApiError(err, 'Couldn’t create post');
    } finally {
      setSubmitting(false);
    }
  }, [associations, body, router]);

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

        <PostComposerAssociationsBar associations={associations} onChange={setAssociations} />

        {hashState.active ? (
          <PostHashSuggestions suggestions={hashSuggestions} onSelect={onSelectHashSuggestion} />
        ) : null}

        <Text className="mb-1 text-xs text-muted-foreground">Content</Text>
        <MarkdownFormatToolbar
          value={body}
          selection={selection}
          onChange={(next, nextSelection) => {
            setBody(next);
            setSelection(nextSelection);
          }}
          showPreviewToggle
          preview={preview}
          onPreviewChange={setPreview}
        />
        {preview ? (
          <View className="mb-3 min-h-[130px] rounded-xl border border-border/40 bg-card/70 px-3 py-3">
            <MarkdownView content={body} />
          </View>
        ) : (
          <TextInput
            value={body}
            onChangeText={setBody}
            onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
            placeholder="What's happening? Type # to link to-dos, lists, or favorites"
            placeholderTextColor="#9ca3af"
            multiline
            className="mb-3 min-h-[130px] rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
            textAlignVertical="top"
          />
        )}
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
      {submitting ? <ActivityIndicator className="pb-4" /> : null}
    </SafeAreaView>
  );
}
