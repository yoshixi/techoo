import { Pressable, ScrollView, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { PostList } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import type { TimelineTab } from '@/lib/timelineTab';

function tabKey(tab: TimelineTab): string {
  if (tab.type === 'all') return 'all';
  if (tab.type === 'favorites') return 'favorites';
  return `list:${tab.listId}`;
}

function TabChip({
  label,
  active,
  onPress,
  onLongPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={`shrink-0 rounded-full px-3 py-1.5 ${active ? 'bg-foreground' : ''}`}
    >
      <Text
        className={`text-xs ${active ? 'font-medium text-background' : 'text-muted-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TimelineTabs({
  lists,
  activeTab,
  onSelect,
  onNewList,
  onListLongPress,
}: {
  lists: PostList[];
  activeTab: TimelineTab;
  onSelect: (tab: TimelineTab) => void;
  onNewList: () => void;
  onListLongPress: (list: PostList) => void;
}) {
  const activeKey = tabKey(activeTab);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}
      className="grow-0"
    >
      <View className="flex-row flex-wrap items-center gap-1.5">
        <TabChip
          label="All"
          active={activeKey === 'all'}
          onPress={() => onSelect({ type: 'all' })}
        />
        <TabChip
          label="Favorites"
          active={activeKey === 'favorites'}
          onPress={() => onSelect({ type: 'favorites' })}
        />
        {lists.map((list) => (
          <TabChip
            key={list.id}
            label={list.name}
            active={activeKey === `list:${list.id}`}
            onPress={() => onSelect({ type: 'list', listId: list.id })}
            onLongPress={() => onListLongPress(list)}
          />
        ))}
        <Pressable
          onPress={onNewList}
          className="flex-row shrink-0 items-center gap-1 rounded-full px-3 py-1.5"
        >
          <Plus size={14} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">New list</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
