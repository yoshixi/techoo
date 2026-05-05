import { useCallback, useState, useMemo } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import type { Note } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotesData } from '@/hooks/useNotesData';
import { NoteComposer } from './NoteComposer';
import { NoteListItem } from './NoteListItem';

export function NoteList() {
  const router = useRouter();
  const {
    notes,
    notesLoading,
    notesError,
    handleCreateNote,
    handleDeleteNote,
    handleTogglePin,
    refreshNotes,
  } = useNotesData();

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (b.pinned !== a.pinned) return b.pinned - a.pinned;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }),
    [notes]
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshNotes();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshNotes]);

  const handleNotePress = useCallback(
    (note: Note) => {
      router.push(`/note/${note.id}`);
    },
    [router]
  );

  const renderNote = useCallback(
    ({ item }: { item: Note }) => (
      <NoteListItem
        note={item}
        onPress={() => handleNotePress(item)}
        onDelete={handleDeleteNote}
        onTogglePin={handleTogglePin}
      />
    ),
    [handleNotePress, handleDeleteNote, handleTogglePin]
  );

  if (notesError) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-2 text-destructive">Failed to load notes</Text>
        <Button onPress={handleRefresh}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {notesLoading ? (
        <View className="gap-3 p-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </View>
      ) : (
        <FlatList
          data={sortedNotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNote}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            <View className="mb-2">
              <Text className="mb-3 text-lg font-semibold">Notes</Text>
              <Text className="mb-3 text-sm text-muted-foreground">
                Off-timeline capture — not the same as posts on your day.
              </Text>
              <NoteComposer onCreateNote={handleCreateNote} />
            </View>
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-8">
              <Text className="text-muted-foreground">No notes yet</Text>
              <Text className="mt-1 text-sm text-muted-foreground">Type above to capture an idea</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
