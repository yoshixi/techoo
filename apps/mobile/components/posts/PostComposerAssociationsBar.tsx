import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { List as ListIcon, Star, X } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import type { PostComposerAssociations } from '@/lib/postComposerAssociations';

export function PostComposerAssociationsBar({
  associations,
  onChange,
}: {
  associations: PostComposerAssociations;
  onChange: (next: PostComposerAssociations) => void;
}) {
  const hasAny =
    associations.event ||
    associations.todo ||
    associations.favorite ||
    associations.lists.length > 0;
  if (!hasAny) return null;

  return (
    <View className="mb-3 flex-row flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2">
      <Text className="text-[11px] text-muted-foreground">Linked</Text>
      {associations.todo ? (
        <AssociationChip
          label={associations.todo.title}
          onRemove={() => onChange({ ...associations, todo: null })}
        />
      ) : null}
      {associations.favorite ? (
        <AssociationChip
          label="Favorites"
          icon={<Star size={12} className="text-foreground" fill="currentColor" />}
          onRemove={() => onChange({ ...associations, favorite: false })}
        />
      ) : null}
      {associations.lists.map((list) => (
        <AssociationChip
          key={list.id}
          label={list.name}
          icon={<ListIcon size={12} className="text-foreground" />}
          onRemove={() =>
            onChange({
              ...associations,
              lists: associations.lists.filter((item) => item.id !== list.id),
            })
          }
        />
      ))}
    </View>
  );
}

function AssociationChip({
  label,
  icon,
  onRemove,
}: {
  label: string;
  icon?: ReactNode;
  onRemove: () => void;
}) {
  return (
    <View className="max-w-[70%] flex-row items-center gap-1 rounded-full border border-border/50 bg-background/80 px-2 py-1">
      {icon}
      <Text className="shrink text-[11px] text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${label}`}>
        <X size={12} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
