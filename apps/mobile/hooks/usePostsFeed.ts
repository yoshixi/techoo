import { useFilteredPostsFeed } from '@/hooks/useFilteredPostsFeed';

const DEFAULT_PAGE_SIZE = 30;

/** All posts newest-first with offset pagination (Timeline tab). */
export function usePostsFeed(pageSize = DEFAULT_PAGE_SIZE) {
  return useFilteredPostsFeed({ type: 'all' }, pageSize);
}
