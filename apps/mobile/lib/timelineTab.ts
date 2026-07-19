import type { PostList } from '@/gen/api/schemas';
import type { PostsFeedFilter } from '@/hooks/useFilteredPostsFeed';

export type TimelineTab = PostsFeedFilter;

export function parseTimelineTabParam(value?: string | string[]): TimelineTab | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'all') return { type: 'all' };
  if (raw === 'favorites') return { type: 'favorites' };
  if (raw.startsWith('list:')) {
    const listId = Number(raw.slice('list:'.length));
    if (Number.isFinite(listId) && listId > 0) return { type: 'list', listId };
  }
  return null;
}

export function encodeTimelineTabParam(tab: TimelineTab): string {
  if (tab.type === 'all') return 'all';
  if (tab.type === 'favorites') return 'favorites';
  return `list:${tab.listId}`;
}

export function timelineTabToFilter(tab: TimelineTab): PostsFeedFilter {
  return tab;
}

export function timelineTabSubtitle(tab: TimelineTab, lists: PostList[]): string {
  if (tab.type === 'all') return 'Simple stream of notes and progress updates';
  if (tab.type === 'favorites') return 'Posts you have starred';
  const list = lists.find((item) => item.id === tab.listId);
  return list ? `Posts saved to “${list.name}”` : 'Posts in this list';
}

export function timelineTabEmptyMessage(tab: TimelineTab): string {
  if (tab.type === 'favorites') return 'No favorites yet. Star posts or create one here.';
  if (tab.type === 'list') return 'No posts in this list yet. Create one here.';
  return 'No posts yet.';
}
