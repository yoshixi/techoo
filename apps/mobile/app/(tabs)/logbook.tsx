import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useFilteredPostsFeed } from '@/hooks/useFilteredPostsFeed';
import { usePostLists } from '@/hooks/usePostLists';
import { TimelinePostsList } from '@/components/posts/TimelinePostsList';
import { TimelineTabs } from '@/components/posts/TimelineTabs';
import { FloatingCreateButton } from '@/components/navigation/FloatingCreateButton';
import { showApiError } from '@/lib/showApiError';
import {
  encodeTimelineTabParam,
  parseTimelineTabParam,
  timelineTabEmptyMessage,
  timelineTabSubtitle,
  timelineTabToFilter,
  type TimelineTab,
} from '@/lib/timelineTab';
import type { PostList } from '@/gen/api/schemas';

export default function LogbookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { lists, isLoading: listsLoading, createList, renameList, deleteList } = usePostLists();

  const initialTab = useMemo(
    () => parseTimelineTabParam(params.tab) ?? { type: 'all' as const },
    [params.tab]
  );
  const [activeTab, setActiveTab] = useState<TimelineTab>(initialTab);
  const [refreshing, setRefreshing] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [editingList, setEditingList] = useState<PostList | null>(null);
  const [editListName, setEditListName] = useState('');
  const [savingListName, setSavingListName] = useState(false);

  useEffect(() => {
    const parsed = parseTimelineTabParam(params.tab);
    if (parsed) setActiveTab(parsed);
  }, [params.tab]);

  const filter = useMemo(() => timelineTabToFilter(activeTab), [activeTab]);
  const { posts, initialLoading, loadingMore, hasMore, loadMore, mutate } =
    useFilteredPostsFeed(filter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await mutate();
    } finally {
      setRefreshing(false);
    }
  }, [mutate]);

  const onCreateList = useCallback(async () => {
    if (creatingList) return;
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setCreatingList(true);
    try {
      const list = await createList(trimmed);
      setNewListName('');
      setNewListOpen(false);
      setActiveTab({ type: 'list', listId: list.id });
    } catch (err) {
      showApiError(err, 'Couldn’t create list');
    } finally {
      setCreatingList(false);
    }
  }, [createList, creatingList, newListName]);

  const onSaveListRename = useCallback(async () => {
    if (!editingList || savingListName) return;
    const trimmed = editListName.trim();
    if (!trimmed) return;
    setSavingListName(true);
    try {
      await renameList(editingList.id, trimmed);
      setEditingList(null);
      setEditListName('');
    } catch (err) {
      showApiError(err, 'Couldn’t rename list');
    } finally {
      setSavingListName(false);
    }
  }, [editListName, editingList, renameList, savingListName]);

  const onListLongPress = useCallback(
    (list: PostList) => {
      Alert.alert(list.name, undefined, [
        {
          text: 'Rename',
          onPress: () => {
            setEditingList(list);
            setEditListName(list.name);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete list',
              `Remove “${list.name}” and its saved posts?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    void deleteList(list.id)
                      .then(() => {
                        if (activeTab.type === 'list' && activeTab.listId === list.id) {
                          setActiveTab({ type: 'all' });
                        }
                      })
                      .catch((err: unknown) => showApiError(err, 'Couldn’t delete list'));
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [activeTab, deleteList]
  );

  const subtitle = timelineTabSubtitle(activeTab, lists);
  const emptyMessage = timelineTabEmptyMessage(activeTab);

  return (
    <View className="flex-1 bg-background">
      <TimelineTabs
        lists={lists}
        activeTab={activeTab}
        onSelect={setActiveTab}
        onNewList={() => setNewListOpen(true)}
        onListLongPress={onListLongPress}
      />
      <View className="px-4 pb-2">
        <Text className="text-xs text-muted-foreground">{subtitle}</Text>
      </View>
      <TimelinePostsList
        posts={posts}
        isLoading={initialLoading || listsLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onLoadMore={() => void loadMore()}
        bottomInset={insets.bottom}
        emptyMessage={emptyMessage}
      />
      <FloatingCreateButton
        bottomInset={insets.bottom}
        accessibilityLabel="Create post"
        onPress={() =>
          router.push({
            pathname: '/post/new',
            params: {
              date: new Date().toISOString(),
              tab: encodeTimelineTabParam(activeTab),
            },
          })
        }
      />

      <Modal visible={newListOpen} transparent animationType="fade" onRequestClose={() => setNewListOpen(false)}>
        <Pressable className="flex-1 justify-center bg-black/40 px-6" onPress={() => setNewListOpen(false)}>
          <Pressable
            className="rounded-2xl bg-card p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="mb-3 text-base font-semibold text-foreground">New list</Text>
            <TextInput
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
              placeholderTextColor="#9ca3af"
              autoFocus
              className="mb-4 rounded-xl border border-border/40 bg-background px-3 py-3 text-sm text-foreground"
              editable={!creatingList}
            />
            <View className="flex-row justify-end gap-3">
              <Pressable onPress={() => setNewListOpen(false)} disabled={creatingList}>
                <Text className="text-sm text-muted-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onCreateList()}
                disabled={creatingList || !newListName.trim()}
              >
                {creatingList ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-primary">Create</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editingList !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingList(null)}
      >
        <Pressable className="flex-1 justify-center bg-black/40 px-6" onPress={() => setEditingList(null)}>
          <Pressable
            className="rounded-2xl bg-card p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="mb-3 text-base font-semibold text-foreground">Rename list</Text>
            <TextInput
              value={editListName}
              onChangeText={setEditListName}
              placeholder="List name"
              placeholderTextColor="#9ca3af"
              autoFocus
              className="mb-4 rounded-xl border border-border/40 bg-background px-3 py-3 text-sm text-foreground"
              editable={!savingListName}
            />
            <View className="flex-row justify-end gap-3">
              <Pressable onPress={() => setEditingList(null)} disabled={savingListName}>
                <Text className="text-sm text-muted-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onSaveListRename()}
                disabled={savingListName || !editListName.trim()}
              >
                {savingListName ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text className="text-sm font-semibold text-primary">Save</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
