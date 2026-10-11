import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { ShareListPicker } from '@/components/posts/ShareListPicker';
import { useAuth } from '@/hooks/useAuth';
import { usePostLists } from '@/hooks/usePostLists';
import {
  createPostWithAssociations,
  emptyPostComposerAssociations,
} from '@/lib/postComposerAssociations';
import { shareIntentToPostBody } from '@/lib/shareIntentPost';
import { dismissShareIntentSession } from '@/lib/shareIntentSession';
import { showApiError } from '@/lib/showApiError';
import { encodeTimelineTabParam } from '@/lib/timelineTab';

export default function ShareIntentScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    lists,
    isLoading: listsLoading,
    createList,
  } = usePostLists({
    enabled: isAuthenticated,
  });

  const [body, setBody] = useState('');
  const [seeded, setSeeded] = useState(false);
  const [selectedList, setSelectedList] = useState<{ id: number; name: string } | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [waitExpired, setWaitExpired] = useState(false);
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaitExpired(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      allowLeaveRef.current = false;
    });
  }, [navigation]);

  useEffect(() => {
    if (!hasShareIntent || seeded) return;
    setBody(shareIntentToPostBody(shareIntent));
    setSeeded(true);
  }, [hasShareIntent, seeded, shareIntent]);

  const leaveToTimeline = useCallback(
    (listId: number | null) => {
      allowLeaveRef.current = true;
      dismissShareIntentSession();
      resetShareIntent();
      router.replace({
        pathname: '/(tabs)/logbook',
        params: {
          tab: encodeTimelineTabParam(listId != null ? { type: 'list', listId } : { type: 'all' }),
        },
      });
    },
    [resetShareIntent, router]
  );

  const cancel = useCallback(() => {
    leaveToTimeline(null);
  }, [leaveToTimeline]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cancel();
      return true;
    });
    return () => subscription.remove();
  }, [cancel]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current) return;
      event.preventDefault();
      cancel();
    });
    return unsubscribe;
  }, [cancel, navigation]);

  const onSignIn = useCallback(() => {
    allowLeaveRef.current = true;
    router.push('/auth');
  }, [router]);

  const onCreateList = useCallback(
    async (name: string) => {
      setCreatingList(true);
      try {
        const list = await createList(name);
        setSelectedList({ id: list.id, name: list.name });
      } catch (err) {
        showApiError(err, 'Couldn’t create list');
        throw err;
      } finally {
        setCreatingList(false);
      }
    },
    [createList]
  );

  const onPost = useCallback(async () => {
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const associations = emptyPostComposerAssociations();
      if (selectedList) associations.lists = [selectedList];
      await createPostWithAssociations(text, associations);
      leaveToTimeline(selectedList?.id ?? null);
    } catch (err) {
      showApiError(err, 'Couldn’t create post');
      setSubmitting(false);
    }
  }, [body, leaveToTimeline, selectedList, submitting]);

  const draft = useMemo(() => body.trim(), [body]);
  const waitingForShare = Platform.OS !== 'web' && !waitExpired && !hasShareIntent && !seeded;
  const canPost = isAuthenticated && Boolean(draft) && !submitting;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center justify-between border-b border-border/35 px-4 py-3">
        <Pressable onPress={cancel} accessibilityLabel="Cancel share">
          <Text className="text-base text-muted-foreground">Cancel</Text>
        </Pressable>
        <Text className="text-base font-semibold text-foreground">Share to timeline</Text>
        <Pressable onPress={() => void onPost()} disabled={!canPost} accessibilityLabel="Post">
          <Text
            className={`text-base font-semibold ${canPost ? 'text-primary' : 'text-muted-foreground'}`}>
            {submitting ? 'Posting...' : 'Post'}
          </Text>
        </Pressable>
      </View>

      {authLoading || waitingForShare ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 pb-8 pt-4">
            <Text className="mb-4 text-sm text-muted-foreground">
              Shared text is added to your timeline.
            </Text>

            {error ? <Text className="mb-3 text-sm text-destructive">{error}</Text> : null}

            {Platform.OS === 'web' ? (
              <Text className="text-sm text-muted-foreground">
                Sharing into Techoo is available in the iPhone and Android apps.
              </Text>
            ) : !hasShareIntent && !draft ? (
              <Text className="text-sm text-muted-foreground">
                Techoo adds shared text and links to your timeline. This share has no text to save.
              </Text>
            ) : (
              <>
                {!isAuthenticated ? (
                  <View className="mb-4 rounded-2xl bg-muted/40 px-3 py-3">
                    <Text className="mb-2 text-sm text-foreground">
                      Sign in to post this to your timeline.
                    </Text>
                    <Pressable onPress={onSignIn} accessibilityLabel="Sign in">
                      <Text className="text-base font-semibold text-primary">Sign in</Text>
                    </Pressable>
                  </View>
                ) : (
                  <ShareListPicker
                    lists={lists}
                    isLoading={listsLoading}
                    selectedListId={selectedList?.id ?? null}
                    onSelect={(listId) => {
                      if (listId == null) {
                        setSelectedList(null);
                        return;
                      }
                      const list = lists.find((item) => item.id === listId);
                      if (list) setSelectedList({ id: list.id, name: list.name });
                    }}
                    onCreateList={onCreateList}
                    creating={creatingList}
                  />
                )}

                <Text className="mb-1 text-xs text-muted-foreground">Content</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Shared text"
                  placeholderTextColor="#9ca3af"
                  multiline
                  editable={!submitting}
                  className="min-h-[160px] rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground"
                  textAlignVertical="top"
                />
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
