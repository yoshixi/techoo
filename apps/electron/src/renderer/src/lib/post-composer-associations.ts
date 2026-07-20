import { postApiV1Posts, postApiV1PostsIdFavorite, postApiV1PostListsIdPosts } from '../gen/api/endpoints/techooAPI.gen'
import type { PostList } from '../gen/api/schemas'
import { revalidateAllPostFeedCaches } from './patch-post-caches'
import type { TimelineTab } from '../components/TimelineTabs'

export type PostComposerAssociations = {
  event: { id: number; title: string } | null
  todo: { id: number; title: string } | null
  favorite: boolean
  lists: Array<{ id: number; name: string }>
}

export function emptyPostComposerAssociations(): PostComposerAssociations {
  return {
    event: null,
    todo: null,
    favorite: false,
    lists: []
  }
}

export function associationsFromTimelineTab(
  tab: TimelineTab,
  lists: PostList[]
): PostComposerAssociations {
  const base = emptyPostComposerAssociations()
  if (tab.type === 'favorites') return { ...base, favorite: true }
  if (tab.type === 'list') {
    const list = lists.find((item) => item.id === tab.listId)
    if (list) return { ...base, lists: [{ id: list.id, name: list.name }] }
  }
  return base
}

export async function applyPostComposerAssociations(
  postId: number,
  associations: PostComposerAssociations
): Promise<void> {
  if (associations.favorite) {
    await postApiV1PostsIdFavorite(postId)
  }
  for (const list of associations.lists) {
    await postApiV1PostListsIdPosts(list.id, { post_id: postId })
  }
}

export async function submitComposerPost(
  body: string,
  associations: PostComposerAssociations,
  options: {
    simpleCreate: (body: string, eventIds: number[], todoIds: number[]) => Promise<void>
    refresh?: () => Promise<void>
  }
): Promise<void> {
  const eventIds = associations.event ? [associations.event.id] : []
  const todoIds = associations.todo ? [associations.todo.id] : []
  const hasCollection = associations.favorite || associations.lists.length > 0

  if (!hasCollection) {
    await options.simpleCreate(body, eventIds, todoIds)
    return
  }

  const res = await postApiV1Posts({
    body,
    event_ids: eventIds,
    todo_ids: todoIds
  })
  await applyPostComposerAssociations(res.data.id, associations)
  await revalidateAllPostFeedCaches()
  await options.refresh?.()
}
