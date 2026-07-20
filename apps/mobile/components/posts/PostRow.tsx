import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ListPlus, Star } from 'lucide-react-native';
import type { Post } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { LinkifiedText } from '@/components/ui/LinkifiedText';
import { formatTodoClockTime } from '@/lib/time';
import { usePostFavorite } from '@/hooks/usePostFavorite';
import { usePostLists } from '@/hooks/usePostLists';
import { AddPostToListModal } from '@/components/posts/AddPostToListModal';
import { PostAssociationChips } from '@/components/posts/PostAssociationChips';
import { showApiError } from '@/lib/showApiError';

const FAVORITE_STAR_COLOR = '#f59e0b';
const MUTED_ICON_COLOR = '#9ca3af';

export function PostRow({
  post,
  onPress,
  showActions = true,
}: {
  post: Post;
  onPress: () => void;
  showActions?: boolean;
}) {
  const { toggleFavorite } = usePostFavorite();
  const { lists } = usePostLists();
  const [listModalOpen, setListModalOpen] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const onToggleFavorite = useCallback(async () => {
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      await toggleFavorite(post);
    } catch (err) {
      showApiError(err, 'Couldn’t update favorite');
    } finally {
      setFavoriteBusy(false);
    }
  }, [favoriteBusy, post, toggleFavorite]);

  return (
    <>
      <Pressable onPress={onPress} className="mb-3 rounded-xl bg-card/60 px-3 py-3 active:opacity-85">
        <View className="mb-1.5 flex-row items-center justify-between gap-2">
          <Text className="text-xs tabular-nums text-muted-foreground">
            {formatTodoClockTime(post.posted_at)}
          </Text>
          {showActions ? (
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  void onToggleFavorite();
                }}
                hitSlop={8}
                accessibilityLabel={
                  post.is_favorited ? 'Remove from favorites' : 'Add to favorites'
                }
                className="h-8 w-8 items-center justify-center rounded-full"
              >
                <Star
                  size={16}
                  color={post.is_favorited ? FAVORITE_STAR_COLOR : MUTED_ICON_COLOR}
                  fill={post.is_favorited ? FAVORITE_STAR_COLOR : 'transparent'}
                />
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setListModalOpen(true);
                }}
                hitSlop={8}
                accessibilityLabel="Add to list"
                className="h-8 w-8 items-center justify-center rounded-full"
              >
                <ListPlus size={16} color={MUTED_ICON_COLOR} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <LinkifiedText text={post.body} className="text-sm leading-snug text-foreground" />
        <PostAssociationChips post={post} lists={lists} />
      </Pressable>
      <AddPostToListModal post={post} visible={listModalOpen} onClose={() => setListModalOpen(false)} />
    </>
  );
}
