import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Bold, Code, Heading2, Italic, Link as LinkIcon, List, ListOrdered, Quote, Strikethrough } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import {
  applyLink,
  toggleLinePrefix,
  wrapSelection,
  type TextSelection,
} from '@/lib/markdownFormat';

const ICON_COLOR = '#6A5C46';

function Tool({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
      className="h-8 w-8 items-center justify-center rounded-md active:bg-muted"
    >
      {children}
    </Pressable>
  );
}

export function MarkdownFormatToolbar({
  value,
  selection,
  onChange,
  showPreviewToggle = false,
  preview = false,
  onPreviewChange,
}: {
  value: string;
  selection: TextSelection;
  onChange: (next: string, nextSelection: TextSelection) => void;
  showPreviewToggle?: boolean;
  preview?: boolean;
  onPreviewChange?: (next: boolean) => void;
}) {
  const apply = (result: { text: string; selection: TextSelection }) => {
    onChange(result.text, result.selection);
  };

  return (
    <View className="mb-1.5 flex-row flex-wrap items-center gap-0.5">
      <Tool label="Bold" onPress={() => apply(wrapSelection(value, selection, '**'))}>
        <Bold size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Italic" onPress={() => apply(wrapSelection(value, selection, '*'))}>
        <Italic size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Strikethrough" onPress={() => apply(wrapSelection(value, selection, '~~'))}>
        <Strikethrough size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Heading" onPress={() => apply(toggleLinePrefix(value, selection, '## '))}>
        <Heading2 size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Bullet list" onPress={() => apply(toggleLinePrefix(value, selection, '- '))}>
        <List size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Numbered list" onPress={() => apply(toggleLinePrefix(value, selection, '1. '))}>
        <ListOrdered size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Quote" onPress={() => apply(toggleLinePrefix(value, selection, '> '))}>
        <Quote size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Code" onPress={() => apply(wrapSelection(value, selection, '`'))}>
        <Code size={15} color={ICON_COLOR} />
      </Tool>
      <Tool label="Link" onPress={() => apply(applyLink(value, selection, 'https://'))}>
        <LinkIcon size={15} color={ICON_COLOR} />
      </Tool>
      {showPreviewToggle ? (
        <Pressable
          onPress={() => onPreviewChange?.(!preview)}
          hitSlop={6}
          className="ml-1 rounded-full border border-border/50 px-2 py-1"
        >
          <Text className="text-[11px] font-medium text-muted-foreground">
            {preview ? 'Edit' : 'Preview'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
