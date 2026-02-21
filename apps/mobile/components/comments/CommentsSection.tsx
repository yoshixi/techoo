import { useState, useCallback } from 'react';
import { View, FlatList, Pressable, Alert } from 'react-native';
import { Send, Trash2 } from 'lucide-react-native';
import { useSWRConfig } from 'swr';
import {
  useGetApiTasksTaskIdComments,
  usePostApiTasksTaskIdComments,
  deleteApiTasksTaskIdCommentsCommentId,
  getGetApiTasksTaskIdCommentsKey,
  getGetApiTasksIdActivitiesKey,
} from '@/gen/api/endpoints/shuchuAPI.gen';
import type { TaskComment } from '@/gen/api/schemas';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/time';

export interface CommentsSectionProps {
  taskId: number;
}

export function CommentsSection({ taskId }: CommentsSectionProps) {
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useGetApiTasksTaskIdComments(taskId);
  const { trigger: createComment, isMutating } = usePostApiTasksTaskIdComments(taskId);
  const [newComment, setNewComment] = useState('');

  const comments = data?.comments ?? [];

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim()) return;
    try {
      await createComment({ body: newComment.trim() });
      await mutate(getGetApiTasksTaskIdCommentsKey(taskId));
      await mutate(getGetApiTasksIdActivitiesKey(taskId));
      setNewComment('');
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  }, [newComment, createComment, mutate, taskId]);

  const handleDelete = useCallback(
    (comment: TaskComment) => {
      Alert.alert('Delete Comment', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteApiTasksTaskIdCommentsCommentId(taskId, comment.id);
            await mutate(getGetApiTasksTaskIdCommentsKey(taskId));
            await mutate(getGetApiTasksIdActivitiesKey(taskId));
          },
        },
      ]);
    },
    [taskId, mutate]
  );

  if (isLoading) {
    return (
      <View className="gap-2">
        <Skeleton className="h-16 w-full rounded" />
        <Skeleton className="h-16 w-full rounded" />
      </View>
    );
  }

  return (
    <View>
      <View className="flex-row gap-2 mb-4">
        <Input
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Add a comment..."
          className="flex-1"
          multiline
        />
        <Button
          onPress={handleSubmit}
          disabled={!newComment.trim() || isMutating}
          size="icon"
        >
          <Send size={16} color="white" />
        </Button>
      </View>

      {comments.length === 0 ? (
        <View className="items-center py-4">
          <Text className="text-sm text-muted-foreground">No comments yet</Text>
        </View>
      ) : (
        <View className="gap-2">
          {comments.map((comment) => (
            <View
              key={comment.id}
              className="p-3 bg-muted/30 rounded-lg"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-sm">{comment.body}</Text>
                  <Text className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(comment.createdAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(comment)}
                  hitSlop={10}
                  className="p-1"
                >
                  <Trash2 size={14} className="text-muted-foreground" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
