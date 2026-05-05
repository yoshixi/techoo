import { useCallback, useState, useEffect } from 'react';
import { View, Pressable, Alert, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Trash2 } from 'lucide-react-native';
import { useGetApiV1NotesId } from '@/gen/api/endpoints/techooAPI.gen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useNotesData, mergeNoteText } from '@/hooks/useNotesData';
import { formatDateTime } from '@/lib/time';

export interface NoteDetailContentProps {
  noteId: number;
}

export function NoteDetailContent({ noteId }: NoteDetailContentProps) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { data: noteData, isLoading, error } = useGetApiV1NotesId(noteId);
  const { handleUpdateNote, handleDeleteNote } = useNotesData();

  const note = noteData?.data;

  const [text, setText] = useState('');

  useEffect(() => {
    if (note) setText(mergeNoteText(note));
  }, [note]);

  const handleSave = useCallback(
    async (value: string) => {
      if (!note) return;
      await handleUpdateNote(note.id, value);
    },
    [note, handleUpdateNote]
  );

  const { isPending } = useAutoSave({
    value: text,
    onSave: handleSave,
    delay: 800,
    enabled: !!note && text !== mergeNoteText(note),
  });

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await handleDeleteNote(noteId);
            router.back();
          } catch {
            /* failure reported in customInstance */
          }
        },
      },
    ]);
  }, [handleDeleteNote, noteId, router]);

  if (isLoading) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="mb-4 h-8 w-3/4" />
        <Skeleton className="mb-2 h-4 w-full" />
      </View>
    );
  }

  if (error || !note) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-destructive">Failed to load note</Text>
        <Button onPress={handleClose} className="mt-4">
          <Text>Go back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <Pressable onPress={handleClose} hitSlop={10}>
          <X size={24} className="text-muted-foreground" />
        </Pressable>
        <View className="flex-row items-center gap-3">
          {isPending ? <Text className="text-xs text-muted-foreground">Saving…</Text> : null}
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Trash2 size={20} className="text-destructive" />
          </Pressable>
        </View>
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Start writing…"
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        autoFocus
        scrollEnabled
        className="flex-1 px-4 pb-8 pt-4 text-base leading-6 text-foreground"
        style={{ minHeight: windowHeight * 0.5 }}
      />

      <View className="border-t border-border px-4 py-2">
        <Text className="text-center text-xs text-muted-foreground">
          {formatDateTime(note.updated_at)}
        </Text>
      </View>
    </View>
  );
}
