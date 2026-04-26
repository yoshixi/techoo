import type { Post } from '../gen/api/schemas'

export type PostDayGroup = {
  dayKey: string
  label: string
  posts: Post[]
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function localDayKey(ts: string): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Heading for a calendar day in the user's local timezone (posts feed).
 */
export function formatPostDayHeading(ts: string, nowMs = Date.now()): string {
  const postDay = startOfLocalDay(new Date(ts))
  const today = startOfLocalDay(new Date(nowMs))
  const diffDays = Math.round((today.getTime() - postDay.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return postDay.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Groups posts by local calendar day. Input order is preserved within each day
 * (newest-first feed stays newest-first per day).
 */
export function groupPostsByLocalDay(posts: Post[]): PostDayGroup[] {
  const groups: PostDayGroup[] = []
  for (const post of posts) {
    const dayKey = localDayKey(post.posted_at)
    const last = groups[groups.length - 1]
    if (last && last.dayKey === dayKey) {
      last.posts.push(post)
    } else {
      groups.push({
        dayKey,
        label: formatPostDayHeading(post.posted_at),
        posts: [post]
      })
    }
  }
  return groups
}
