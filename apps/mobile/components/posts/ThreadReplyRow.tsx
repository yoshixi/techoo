import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import type { Post } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { MarkdownComposer } from '@/components/markdown/MarkdownComposer';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import { formatDateTime } from '@/lib/time';

export function ThreadReplyRow({
  reply,
  onUpdate,
  onDelete,
}: {
  reply: Post;
  onUpdate: (id: number, body: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(reply.body);
  }, [editing, reply.body]);

  const onSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onUpdate(reply.id, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [draft, onUpdate, reply.id, saving]);

  const onConfirmDelete = useCallback(() => {
    Alert.alert('Delete reply', 'Remove this reply?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void onDelete(reply.id);
        },
      },
    ]);
  }, [onDelete, reply.id]);

  return (
    <View className="rounded-xl border border-border/35 bg-card/60 px-3 py-2.5">
      {editing ? (
        <>
          <MarkdownComposer
            value={draft}
            onChange={setDraft}
            minHeight={72}
            showPreviewToggle
            inputClassName="min-h-[72px] rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground"
          />
          <View className="mt-2 flex-row justify-end gap-3">
            <Pressable onPress={() => setEditing(false)} disabled={saving}>
              <Text className="text-sm text-muted-foreground">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void onSave()} disabled={saving || !draft.trim()}>
              <Text
                className={`text-sm font-semibold ${
                  saving || !draft.trim() ? 'text-muted-foreground' : 'text-primary'
                }`}
              >
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <MarkdownView content={reply.body} />
          <Text className="mt-1 text-[11px] text-muted-foreground">
            {formatDateTime(reply.posted_at)}
          </Text>
          <View className="mt-2 flex-row justify-end gap-3">
            <Pressable onPress={() => setEditing(true)}>
              <Text className="text-xs font-medium text-primary">Edit</Text>
            </Pressable>
            <Pressable onPress={onConfirmDelete}>
              <Text className="text-xs font-medium text-destructive">Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
