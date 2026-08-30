import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { usePostThread } from '@/hooks/usePostThread';
import { deleteApiV1PostsId } from '@/gen/api/endpoints/techooAPI.gen';
import { formatTime } from '@/lib/time';
import { showApiError } from '@/lib/showApiError';
import { ThreadReplyRow } from '@/components/posts/ThreadReplyRow';
import { revalidateAllPostLists } from '@/lib/revalidatePostLists';
import { revalidateAllPostFeedCaches } from '@/lib/patchPostCaches';

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id != null ? Number(id) : NaN;
  const thread = usePostThread(Number.isNaN(postId) ? null : postId);
  const post = thread.root;
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postingReply, setPostingReply] = useState(false);

  const replies = useMemo(
    () =>
      [...thread.replies].sort(
        (a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime()
      ),
    [thread.replies]
  );

  useEffect(() => {
    if (post) setBody(post.body);
  }, [post]);

  const onSaveRoot = useCallback(async () => {
    if (!post || submitting) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await thread.updatePost(post.id, trimmed);
    } catch (err) {
      showApiError(err, 'Couldn’t update post');
    } finally {
      setSubmitting(false);
    }
  }, [body, post, submitting, thread]);

  const onDeleteRoot = useCallback(() => {
    if (!post || submitting) return;
    Alert.alert('Delete post', 'Remove this post and its replies?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSubmitting(true);
          void deleteApiV1PostsId(post.id)
            .then(() => Promise.all([revalidateAllPostFeedCaches(), revalidateAllPostLists()]))
            .then(() => {
              router.replace('/(tabs)/logbook');
            })
            .catch((err: unknown) => {
              showApiError(err, 'Couldn’t delete post');
            })
            .finally(() => setSubmitting(false));
        },
      },
    ]);
  }, [post, router, submitting]);

  const onReply = useCallback(async () => {
    if (postingReply) return;
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    setPostingReply(true);
    try {
      await thread.createReply(trimmed);
      setReplyBody('');
    } catch (err) {
      showApiError(err, 'Couldn’t add reply');
    } finally {
      setPostingReply(false);
    }
  }, [postingReply, replyBody, thread]);

  const onUpdateReply = useCallback(
    async (replyId: number, nextBody: string) => {
      try {
        await thread.updatePost(replyId, nextBody);
      } catch (err) {
        showApiError(err, 'Couldn’t update reply');
        throw err;
      }
    },
    [thread]
  );

  const onDeleteReply = useCallback(
    async (replyId: number) => {
      try {
        await thread.deletePost(replyId);
      } catch (err) {
        showApiError(err, 'Couldn’t delete reply');
      }
    },
    [thread]
  );

  if (id == null || Number.isNaN(postId)) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between border-b border-border/35 px-4 py-3">
        <Pressable onPress={() => router.back()}>
          <Text className="text-base text-muted-foreground">Close</Text>
        </Pressable>
        <Text className="text-base font-semibold text-foreground">Thread</Text>
        <Pressable onPress={() => void onSaveRoot()} disabled={submitting || !body.trim()}>
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
        {thread.isLoading && !post ? <Text className="text-sm text-muted-foreground">Loading...</Text> : null}
        {!thread.isLoading && !post ? (
          <Text className="text-sm text-muted-foreground">
            {thread.error ? 'Couldn’t load thread.' : 'Thread not found.'}
          </Text>
        ) : null}
        {post ? (
          <>
            <Text className="mb-1 text-xs text-muted-foreground">
              {new Date(post.posted_at).toLocaleDateString()} at {formatTime(post.posted_at)}
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="What happened?"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              className="min-h-[120px] rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
            />

            <View className="mt-5">
              <Text className="mb-2 text-xs text-muted-foreground">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Text>
              {replies.length === 0 ? (
                <Text className="text-sm text-muted-foreground">No replies yet.</Text>
              ) : (
                <View className="gap-2.5">
                  {replies.map((reply) => (
                    <ThreadReplyRow
                      key={reply.id}
                      reply={reply}
                      onUpdate={onUpdateReply}
                      onDelete={onDeleteReply}
                    />
                  ))}
                </View>
              )}
            </View>

            <View className="mt-5 rounded-xl border border-border/35 bg-card/60 px-3 py-3">
              <Text className="mb-1 text-xs text-muted-foreground">Reply</Text>
              <TextInput
                value={replyBody}
                onChangeText={setReplyBody}
                placeholder="Write a reply..."
                placeholderTextColor="#9ca3af"
                multiline
                textAlignVertical="top"
                className="min-h-[90px] rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground"
              />
              <View className="mt-2 flex-row justify-end">
                <Pressable onPress={() => void onReply()} disabled={postingReply || !replyBody.trim()}>
                  <Text
                    className={`text-sm font-semibold ${
                      postingReply || !replyBody.trim() ? 'text-muted-foreground' : 'text-primary'
                    }`}
                  >
                    {postingReply ? 'Posting...' : 'Reply'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={onDeleteRoot}
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
