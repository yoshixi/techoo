import type { DB } from './common.db'
import type { TaskTimer } from './timers.db'
import type { TaskComment } from './comments.db'
import { getTimersByTaskId } from './timers.db'
import { getCommentsByTaskId } from './comments.db'

export type TaskActivityItem =
  | { type: 'timer'; data: TaskTimer }
  | { type: 'comment'; data: TaskComment }

function getTimerTimestamp(timer: TaskTimer): number {
  const anchor = timer.endTime ?? timer.startTime
  return Date.parse(anchor)
}

function getCommentTimestamp(comment: TaskComment): number {
  return Date.parse(comment.createdAt)
}

function getActivityTimestamp(item: TaskActivityItem): number {
  return item.type === 'timer' ? getTimerTimestamp(item.data) : getCommentTimestamp(item.data)
}

function getActivityTieBreaker(item: TaskActivityItem): number {
  return item.data.id
}

export async function getTaskActivities(
  db: DB,
  userId: number,
  taskId: number
): Promise<TaskActivityItem[] | null> {
  const timers = await getTimersByTaskId(db, userId, taskId)
  if (timers === null) {
    return null
  }

  const comments = await getCommentsByTaskId(db, userId, taskId)
  if (comments === null) {
    return null
  }

  const timeline = [
    ...timers.map<TaskActivityItem>((timer) => ({ type: 'timer', data: timer })),
    ...comments.map<TaskActivityItem>((comment) => ({ type: 'comment', data: comment }))
  ]

  return timeline.sort((a, b) => {
    const timeDiff = getActivityTimestamp(b) - getActivityTimestamp(a)
    if (timeDiff !== 0) {
      return timeDiff
    }
    return getActivityTieBreaker(b) - getActivityTieBreaker(a)
  })
}
