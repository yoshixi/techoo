import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { usePosts } from '@/hooks/usePosts';
import { patchApiV1PostsId } from '@/gen/api/endpoints/techooAPI.gen';
import { formatTime } from '@/lib/time';
import { showApiError } from '@/lib/showApiError';
import { revalidateAllPostLists } from '@/lib/revalidatePostLists';

function buildRange(postedAt: Date): { from: Date; to: Date } {
  const from = new Date(postedAt);
  from.setDate(from.getDate() - 7);
  const to = new Date(postedAt);
  to.setDate(to.getDate() + 8);
  return { from, to };
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id, postedAt } = useLocalSearchParams<{ id: string; postedAt?: string }>();
  const postId = id != null ? Number(id) : NaN;
  const anchor = useMemo(() => {
    const parsed = postedAt ? new Date(postedAt) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [postedAt]);
  const range = useMemo(() => buildRange(anchor), [anchor]);
  const { posts, deletePost, isLoading } = usePosts({ ...range, limit: 2000 });
  const post = useMemo(() => posts.find((item) => item.id === postId), [posts, postId]);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (post) setBody(post.body);
  }, [post]);

  const onSave = useCallback(async () => {
    if (!post || submitting) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await patchApiV1PostsId(post.id, { body: trimmed });
      await revalidateAllPostLists();
      router.back();
    } catch (err) {
      showApiError(err, 'Couldn’t update post');
    } finally {
      setSubmitting(false);
    }
  }, [body, post, router, submitting]);

  const onDelete = useCallback(() => {
    if (!post || submitting) return;
    Alert.alert('Delete post', 'Remove this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSubmitting(true);
          void deletePost(post.id)
            .then(() => {
              router.back();
            })
            .catch((err: unknown) => {
              showApiError(err, 'Couldn’t delete post');
            })
            .finally(() => setSubmitting(false));
        },
      },
    ]);
  }, [deletePost, post, router, submitting]);

  if (id == null || Number.isNaN(postId)) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between border-b border-border/35 px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-muted-foreground">Close</Text>
        </Pressable>
        <Text className="text-base font-semibold text-foreground">Post</Text>
        <Pressable onPress={() => void onSave()} disabled={submitting || !body.trim()}>
          <Text
            className={`text-base font-semibold ${
              submitting || !body.trim() ? 'text-muted-foreground' : 'text-primary'
            }`}
          >
            {submitting ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {isLoading && !post ? <Text className="text-sm text-muted-foreground">Loading...</Text> : null}
        {!isLoading && !post ? (
          <Text className="text-sm text-muted-foreground">Post not found in this timeline range.</Text>
        ) : null}
        {post ? (
          <>
            <Text className="mb-1 text-xs text-muted-foreground">
              {new Date(post.posted_at).toLocaleDateString()} at {formatTime(post.posted_at)}
            </Text>
            <Text className="mb-1 mt-2 text-xs text-muted-foreground">Content</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="What happened?"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              className="min-h-[150px] rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
            />

            {post.todos.length > 0 ? (
              <View className="mt-4 gap-1.5">
                <Text className="text-xs text-muted-foreground">Linked ToDos</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {post.todos.map((todo) => (
                    <View
                      key={todo.id}
                      className="min-h-[32px] justify-center rounded-xl border border-primary/35 bg-primary/10 px-2.5 py-1"
                    >
                      <Text className="text-xs font-semibold text-primary">{todo.title}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={onDelete}
              disabled={submitting}
              className="mt-8 items-center rounded-xl border border-destructive/35 bg-destructive/10 py-3"
            >
              <Text className="text-sm font-semibold text-destructive">
                {submitting ? 'Working...' : 'Delete post'}
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
