import { View } from 'react-native';
import { NoteList } from '@/components/notes/NoteList';

export default function NotesScreen() {
  return (
    <View className="flex-1 bg-background">
      <NoteList />
    </View>
  );
}
