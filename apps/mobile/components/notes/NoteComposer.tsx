import { useState, useCallback } from 'react';
import { View, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';

export interface NoteComposerProps {
  onCreateNote: (text: string) => void | Promise<void>;
}

export function NoteComposer({ onCreateNote }: NoteComposerProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    const trimmed = text.trim();
    try {
      await Promise.resolve(onCreateNote(trimmed));
      setText('');
    } catch {
      setText(trimmed);
    }
  }, [text, onCreateNote]);

  return (
    <View className="bg-card border border-border rounded-lg p-3 mb-4">
      <Text className="text-sm font-medium mb-2">Quick Note</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Capture an idea..."
        placeholderTextColor="#9ca3af"
        className="bg-white px-3 py-2 rounded-md text-foreground native:text-base"
        style={{
          borderWidth: 1,
          borderColor: isFocused ? THEME.light.primary : THEME.light.border,
        }}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => void handleSubmit()}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      <Text className="text-xs text-muted-foreground mt-2">
        First line becomes the title
      </Text>
    </View>
  );
}
