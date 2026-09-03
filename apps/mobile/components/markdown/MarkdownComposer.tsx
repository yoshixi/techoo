import { useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { MarkdownFormatToolbar } from '@/components/markdown/MarkdownFormatToolbar';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import { applyMarkdownShortcutFromKeyEvent, type TextSelection } from '@/lib/markdownFormat';

export function MarkdownComposer({
  value,
  onChange,
  placeholder,
  minHeight = 96,
  showPreviewToggle = true,
  inputClassName,
  inputProps,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  minHeight?: number;
  showPreviewToggle?: boolean;
  inputClassName?: string;
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'onSelectionChange'>;
}) {
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const [preview, setPreview] = useState(false);
  const { onKeyPress: onInputKeyPress, ...restInputProps } = inputProps ?? {};

  return (
    <View>
      <MarkdownFormatToolbar
        value={value}
        selection={selection}
        onChange={(next, nextSelection) => {
          onChange(next);
          setSelection(nextSelection);
        }}
        showPreviewToggle={showPreviewToggle}
        preview={preview}
        onPreviewChange={setPreview}
      />
      {preview ? (
        <View
          className="rounded-xl border border-border/40 bg-card/70 px-3 py-3"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <TextInput
              editable={false}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              value=""
            />
          )}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
          onKeyPress={(event) => {
            const result = applyMarkdownShortcutFromKeyEvent(value, selection, event.nativeEvent);
            if (result) {
              event.preventDefault();
              onChange(result.text);
              setSelection(result.selection);
              return;
            }
            onInputKeyPress?.(event);
          }}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          className={
            inputClassName ??
            'rounded-xl border border-border/40 bg-card/70 px-3 py-3 text-sm text-foreground'
          }
          style={{ minHeight }}
          {...restInputProps}
        />
      )}
    </View>
  );
}
