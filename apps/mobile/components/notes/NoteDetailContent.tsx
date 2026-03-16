import { useCallback, useState, useEffect } from 'react';
import { View, Pressable, Alert, TextInput, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Trash2, Archive, ArrowRightLeft } from 'lucide-react-native';
import { useGetApiNotesId } from '@/gen/api/endpoints/techoAPI.gen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useNotesData, mergeNoteText } from '@/hooks/useNotesData';
import { formatDateTime } from '@/lib/time';
import { ConvertToTaskSheet } from './ConvertToTaskSheet';

export interface NoteDetailContentProps {
  noteId: number;
}

export function NoteDetailContent({ noteId }: NoteDetailContentProps) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { data: noteData, isLoading, error } = useGetApiNotesId(noteId);
  const { handleUpdateNote, handleDeleteNote, handleArchiveNote, handleConvertToTask } = useNotesData();

  const note = noteData?.note;

  const [text, setText] = useState('');
  const [showConvertSheet, setShowConvertSheet] = useState(false);

  useEffect(() => {
    if (note) {
      setText(mergeNoteText(note));
    }
  }, [note]);

  const handleSave = useCallback(
    async (value: string) => {
      if (!note) return;
      handleUpdateNote(note.id, value);
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
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await handleDeleteNote(noteId);
          router.back();
        },
      },
    ]);
  }, [handleDeleteNote, noteId, router]);

  const handleArchive = useCallback(async () => {
    await handleArchiveNote(noteId);
    router.back();
  }, [handleArchiveNote, noteId, router]);

  if (isLoading) {
    return (
      <View className="flex-1 p-4">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </View>
    );
  }

  if (error || !note) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-destructive">Failed to load note</Text>
        <Button onPress={handleClose} className="mt-4">
          <Text>Go Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Pressable onPress={handleClose} hitSlop={10}>
          <X size={24} className="text-muted-foreground" />
        </Pressable>
        <View className="flex-row items-center gap-4">
          {isPending && (
            <Text className="text-xs text-muted-foreground">Saving...</Text>
          )}
          <Pressable onPress={() => setShowConvertSheet(true)} hitSlop={10}>
            <ArrowRightLeft size={18} className="text-muted-foreground" />
          </Pressable>
          <Pressable onPress={handleArchive} hitSlop={10}>
            <Archive size={18} className="text-muted-foreground" />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={10}>
            <Trash2 size={18} className="text-destructive" />
          </Pressable>
        </View>
      </View>

      {/* Full-screen text editor */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Start writing..."
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        autoFocus
        scrollEnabled
        className="flex-1 px-4 pt-4 pb-8 text-foreground text-base leading-6"
        style={{ minHeight: windowHeight * 0.5 }}
      />

      {/* Timestamp footer */}
      <View className="px-4 py-2 border-t border-border">
        <Text className="text-xs text-muted-foreground text-center">
          {formatDateTime(note.updatedAt)}
        </Text>
      </View>

      <ConvertToTaskSheet
        visible={showConvertSheet}
        note={note}
        onClose={() => setShowConvertSheet(false)}
        onConvert={async (noteId, schedule) => {
          await handleConvertToTask(noteId, schedule);
          router.back();
        }}
      />
    </View>
  );
}
